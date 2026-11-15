import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { FallaResponse, HistorialMantenimientoResponse } from '../../../../core/models/CisternaModel';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { ahoraLocal, mensajeHttp } from '../../fallas/formulario/reportar-falla';

/**
 * El técnico registra el trabajo hecho para atender una falla. POST /historial (solo TECNICO).
 * Opcionalmente cierra la falla (PATCH /fallas/estado → RESUELTA) si estaba EN_REPARACION.
 */
@Component({ selector: 'app-registrar-mantenimiento', imports: [ReactiveFormsModule, RouterLink, InputTextModule, FechaPipe], templateUrl: './registrar-mantenimiento.html' })
export class RegistrarMantenimiento {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  /** Solo fallas sin resolver: son las que admiten trabajo de mantenimiento. */
  readonly fallas = signal<FallaResponse[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly maxFecha = ahoraLocal();
  readonly form = inject(FormBuilder).group({
    idFalla: [null as number | null, Validators.required],
    fecha: [ahoraLocal(), Validators.required],
    descripcion: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(250)]],
    resultado: ['', Validators.maxLength(250)],
    observaciones: ['', Validators.maxLength(250)],
    costo: [null as number | null, Validators.min(0)],
    marcarResuelta: [true],
  });
  private readonly idFalla = toSignal(this.form.controls.idFalla.valueChanges, { initialValue: null });
  readonly fallaElegida = computed(() => this.fallas().find(f => f.idFalla === Number(this.idFalla())));

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const preseleccion = Number(params.get('falla')) || null;
    // «Registrar trabajo» (resolver=0) es un avance parcial; «Marcar resuelta» (resolver=1) o el menú dejan el cierre marcado.
    this.form.controls.marcarResuelta.setValue(params.get('resolver') !== '0');
    this.api.get<FallaResponse[]>('fallas').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: f => {
        this.fallas.set(f.filter(x => x.estado !== 'RESUELTA').sort((a, b) => a.idFalla - b.idFalla));
        if (preseleccion && this.fallas().some(x => x.idFalla === preseleccion)) this.form.controls.idFalla.setValue(preseleccion);
        this.cargando.set(false);
      },
      error: e => { this.error.set(mensajeHttp(e, 'No se pudieron cargar las fallas.')); this.cargando.set(false); },
    });
  }

  invalido(campo: 'idFalla' | 'fecha' | 'descripcion' | 'resultado' | 'observaciones' | 'costo') { const c = this.form.controls[campo]; return c.touched && c.invalid; }

  guardar() {
    if (this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set('');
    const v = this.form.getRawValue();
    if (this.form.invalid) { this.error.set('Revisa la falla, la fecha, la descripción y que el costo no sea negativo.'); return; }
    if (v.fecha! > ahoraLocal()) { this.error.set('La fecha del mantenimiento no puede estar en el futuro.'); return; }
    const cerrar = !!v.marcarResuelta && this.fallaElegida()?.estado === 'EN_REPARACION';
    this.guardando.set(true);
    this.api.post<HistorialMantenimientoResponse>('historial', {
      idFalla: v.idFalla, fecha: v.fecha, descripcion: v.descripcion!.trim(),
      resultado: v.resultado?.trim() || null, observaciones: v.observaciones?.trim() || null, costo: v.costo ?? null,
    }).pipe(
      // Si el mantenimiento ya se guardó pero el cierre falla, no se informa como error (evita registrarlo dos veces).
      switchMap(h => !cerrar ? of({ h, cierre: '' }) : this.api.patch<FallaResponse>('fallas/estado', { idFalla: v.idFalla, estado: 'RESUELTA' }).pipe(
        map(() => ({ h, cierre: ` y falla #${v.idFalla} marcada como RESUELTA` })),
        catchError(() => of({ h, cierre: `, pero no se pudo cerrar la falla #${v.idFalla}: márcala como RESUELTA desde el listado de fallas` })),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ h, cierre }) => void this.router.navigate(['/dashboard/historial'], { state: { aviso: `Mantenimiento #${h.idHistorial} registrado${cierre}.` } }),
      error: e => { this.guardando.set(false); this.error.set(mensajeHttp(e, 'No se pudo registrar el mantenimiento.')); },
    });
  }
}
