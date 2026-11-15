import { DestroyRef, Directive, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { PedidoResponse } from '../../../../core/models/PedidoModel';
import { AtencionResponse } from '../../../../core/models/AtencionModel';
import { CisternaResponse } from '../../../../core/models/CisternaModel';

export interface Conductor { idTrabajador: number; nombres: string; apellidos: string; estado: string; }

/**
 * Lógica común de Programar atención y Editar atención (PROGRAMADOR):
 * recursos (pedidos, cisternas, conductores), disponibilidad por horario y guardado.
 * Una cisterna o conductor está ocupado si tiene otra atención PROGRAMADA/EN_CURSO que se cruza con el horario.
 */
@Directive()
export abstract class AtencionFormularioBase {
  protected readonly api = inject(ApiService);
  protected readonly fb = inject(FormBuilder);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  /** Atención en edición (null = programar una nueva). */
  readonly idEdicion = signal<number | null>(null);
  readonly original = signal<AtencionResponse | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly errorCarga = signal('');
  readonly error = signal('');
  readonly creada = signal<AtencionResponse | null>(null);
  readonly pedidos = signal<PedidoResponse[]>([]);
  readonly cisternas = signal<CisternaResponse[]>([]);
  readonly conductores = signal<Conductor[]>([]);
  readonly atenciones = signal<AtencionResponse[]>([]);
  readonly intervalo = signal({ inicio: '', fin: '' });
  readonly form = this.fb.group({
    idPedido: this.fb.control<number | null>(null, Validators.required),
    fechaInicioProgramada: ['', Validators.required], fechaFinProgramada: ['', Validators.required],
    idCisterna: this.fb.control<number | null>(null, Validators.required),
    idConductor: this.fb.control<number | null>(null, Validators.required),
    observaciones: ['', Validators.maxLength(250)],
  });
  readonly pendientes = computed(() => this.pedidos().filter(p => ['RECIBIDO', 'EN_PREPARACION'].includes(p.estado)
    && !this.atenciones().some(a => a.idAtencion !== this.idEdicion() && a.idPedido === p.idPedido && ['PROGRAMADA', 'EN_CURSO'].includes(a.estado))));
  readonly intervaloValido = computed(() => {
    const { inicio, fin } = this.intervalo();
    return !!inicio && !!fin && new Date(fin).getTime() > new Date(inicio).getTime();
  });
  readonly cisternasDisponibles = computed(() => this.intervaloValido() ? this.cisternas().filter(c => !this.ocupado('idCisterna', c.idCisterna)) : []);
  readonly conductoresDisponibles = computed(() => this.intervaloValido() ? this.conductores().filter(c => !this.ocupado('idConductor', c.idTrabajador)) : []);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v => this.intervalo.set({ inicio: v.fechaInicioProgramada || '', fin: v.fechaFinProgramada || '' }));
  }

  private ocupado(campo: 'idCisterna' | 'idConductor', id: number) {
    const { inicio, fin } = this.intervalo();
    return this.atenciones().some(a => a.idAtencion !== this.idEdicion() && a[campo] === id && ['PROGRAMADA', 'EN_CURSO'].includes(a.estado)
      && (!a.fechaFinProgramada || (new Date(a.fechaInicioProgramada).getTime() < new Date(fin).getTime()
        && new Date(a.fechaFinProgramada).getTime() > new Date(inicio).getTime())));
  }

  /** Carga recursos (y la atención si `id` no es null). `alCargar` se ejecuta con todo listo. */
  protected cargarDatos(id: number | null, alCargar?: () => void) {
    this.idEdicion.set(id); this.original.set(null); this.creada.set(null); this.error.set('');
    this.form.reset(); this.form.controls.idPedido.enable();
    this.cargando.set(true); this.errorCarga.set('');
    forkJoin({ original: id === null ? of(null) : this.api.get<AtencionResponse>(`atenciones/${id}`), pedidos: this.api.get<PedidoResponse[]>('pedidos'), atenciones: this.api.get<AtencionResponse[]>('atenciones'), cisternas: this.api.get<CisternaResponse[]>('cisternas/activas'), conductores: this.api.get<Conductor[]>('conductores/activos') })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: datos => {
          this.pedidos.set(datos.pedidos); this.atenciones.set(datos.atenciones); this.cisternas.set(datos.cisternas); this.conductores.set(datos.conductores);
          this.original.set(datos.original);
          if (datos.original) {
            if (datos.original.estado !== 'PROGRAMADA') {
              this.errorCarga.set('Solo se puede editar una atención PROGRAMADA.'); this.cargando.set(false); return;
            }
            this.form.patchValue(datos.original);
            this.form.controls.idPedido.disable();
          }
          alCargar?.();
          this.cargando.set(false);
        },
        error: () => { this.cargando.set(false); this.errorCarga.set('No se pudieron cargar los pedidos y recursos. Intenta nuevamente.'); },
      });
  }

  guardar() {
    if (this.guardando() || this.cargando() || this.errorCarga() || this.creada()) return;
    this.error.set(''); this.form.markAllAsTouched();
    if (this.form.invalid) { this.error.set('Completa los campos obligatorios y revisa las observaciones.'); return; }
    if (!this.intervaloValido()) { this.error.set('La hora de fin debe ser posterior a la hora de inicio.'); return; }
    const v = this.form.getRawValue();
    if (this.idEdicion() === null && !this.pendientes().some(p => p.idPedido === v.idPedido)) { this.error.set('Selecciona un pedido pendiente sin atención activa.'); return; }
    if (!this.cisternasDisponibles().some(c => c.idCisterna === v.idCisterna) || !this.conductoresDisponibles().some(c => c.idTrabajador === v.idConductor)) {
      this.error.set('Selecciona una cisterna y un conductor disponibles para el horario indicado.'); return;
    }
    this.guardando.set(true);
    const { idPedido, ...cambios } = v;
    const operacion = this.idEdicion() === null ? this.api.post<AtencionResponse>('atenciones', v)
      : this.api.patch<AtencionResponse>(`atenciones/${this.idEdicion()}`, cambios);
    operacion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: atencion => { this.creada.set(atencion); this.guardando.set(false); },
      error: respuesta => {
        this.guardando.set(false);
        this.error.set(respuesta.status === 400 ? (respuesta.error?.message || 'Revisa los datos de la programación.')
          : respuesta.status === 401 ? 'Tu sesión ha vencido. Vuelve a iniciar sesión.'
          : respuesta.status === 403 ? 'Solo el programador puede registrar atenciones.'
          : 'No se pudo confirmar la programación. Consulta Atenciones antes de volver a enviarla.');
      },
    });
  }
}
