import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, combineLatest, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { AlertaService } from '../../../../core/services/atencion/alerta-service';
import { AtencionResponse } from '../../../../core/models/AtencionModel';
import { AlertaResponse, TIPOS_ALERTA, TipoAlerta } from '../../../../core/models/AlertaModel';

/**
 * CONDUCTOR · Detalle de una atención asignada.
 * - Iniciar (PROGRAMADA → EN_CURSO) y finalizar (EN_CURSO → FINALIZADA).
 * - Reportar incidencias mientras está EN_CURSO y ver cómo las atiende el programador.
 */
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
@Component({ selector: 'app-atencion-conductor', imports: [FechaPipe, CommonModule, RouterLink, ReactiveFormsModule], templateUrl: './detalle-atencion.html' })
export class AtencionConductor {
  private readonly api = inject(ApiService);
  private readonly alertasApi = inject(AlertaService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly atencion = signal<AtencionResponse | null>(null);
  readonly enCurso = signal<AtencionResponse | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly confirmarFin = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  // ----- Incidencias (alertas) -----
  readonly tipos = Object.entries(TIPOS_ALERTA) as [TipoAlerta, string][];
  readonly etiqueta: Record<string, string> = TIPOS_ALERTA;
  readonly alertas = signal<AlertaResponse[]>([]);
  readonly errorAlertas = signal('');
  readonly mostrarReporte = signal(false);
  readonly reportando = signal(false);
  readonly errorReporte = signal('');
  private readonly fb = inject(FormBuilder);
  readonly reporte = this.fb.group({
    tipo: this.fb.control<TipoAlerta | null>(null, Validators.required),
    mensaje: this.fb.control('', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(250)]),
  });

  constructor() {
    combineLatest([this.route.paramMap, this.reload.pipe(startWith(undefined))]).pipe(
      tap(() => { this.cargando.set(true); this.atencion.set(null); this.error.set(''); this.mensaje.set(''); this.confirmarFin.set(false); this.errorAlertas.set(''); }),
      switchMap(([params]) => {
        const id = Number(params.get('id'));
        if (!Number.isSafeInteger(id) || id < 1) { this.error.set('El identificador de la atención no es válido.'); return of(null); }
        return forkJoin({
          actual: this.api.get<AtencionResponse>(`atenciones/asignadas/${id}`),
          asignadas: this.api.get<AtencionResponse[]>('atenciones/asignadas'),
          // Si fallan las alertas, la atención igual se muestra.
          alertas: this.alertasApi.porAtencion(id).pipe(catchError(() => {
            this.errorAlertas.set('No se pudieron consultar las incidencias de esta atención.'); return of([] as AlertaResponse[]);
          })),
        }).pipe(map(d => {
          this.enCurso.set(d.asignadas.find(a => a.estado === 'EN_CURSO') || null);
          this.alertas.set([...d.alertas].sort((x, y) => y.fechaHora.localeCompare(x.fechaHora)));
          return d.actual;
        }), catchError(e => { this.error.set(this.errorTexto(e.status)); return of(null); }));
      }), takeUntilDestroyed(this.destroyRef),
    ).subscribe(a => { this.atencion.set(a); this.cargando.set(false); });
  }
  actualizar() { if (!this.guardando() && !this.cargando()) this.reload.next(); }
  cambiar(accion: 'iniciar' | 'finalizar') {
    const a = this.atencion();
    if (!a || this.guardando() || (accion === 'iniciar' ? a.estado !== 'PROGRAMADA' || !!this.enCurso() : a.estado !== 'EN_CURSO' || !this.confirmarFin())) return;
    this.guardando.set(true); this.error.set(''); this.mensaje.set('');
    this.api.patch<AtencionResponse>(`atenciones/${a.idAtencion}/${accion}`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: actualizada => {
        this.atencion.set(actualizada); this.enCurso.set(accion === 'iniciar' ? actualizada : null); this.guardando.set(false); this.confirmarFin.set(false);
        if (accion === 'finalizar') this.mostrarReporte.set(false);
        this.mensaje.set(accion === 'iniciar' ? 'Atención iniciada correctamente.' : 'Atención finalizada correctamente.');
      },
      error: e => { this.guardando.set(false); this.confirmarFin.set(false); this.error.set(e.status === 400 ? (e.error?.message || 'El estado de la atención no permite esta acción. Actualiza los datos.') : this.errorTexto(e.status)); },
    });
  }

  /** Regla del backend: solo en una atención EN_CURSO asignada al conductor. */
  reportar() {
    const a = this.atencion();
    if (!a || a.estado !== 'EN_CURSO' || this.reportando()) return;
    this.reporte.markAllAsTouched();
    if (this.reporte.invalid) return;
    const { tipo, mensaje } = this.reporte.getRawValue();
    this.reportando.set(true); this.errorReporte.set(''); this.mensaje.set('');
    this.alertasApi.reportar({ tipo: tipo!, mensaje: mensaje!.trim(), idAtencion: a.idAtencion }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerta => {
        this.alertas.update(lista => [alerta, ...lista]);
        this.reportando.set(false); this.mostrarReporte.set(false); this.reporte.reset();
        this.mensaje.set(`Incidencia #${alerta.idAlerta} reportada. El programador la verá como pendiente.`);
      },
      error: (e: HttpErrorResponse) => {
        this.reportando.set(false);
        this.errorReporte.set(e.status === 400 ? (e.error?.message || Object.values(e.error?.details ?? {}).join('. ') || 'Revisa los datos de la incidencia.')
          : this.errorTexto(e.status));
      },
    });
  }

  private errorTexto(status: number) {
    return status === 404 ? 'La atención no existe o no está asignada a tu cuenta.' : status === 401 ? 'Tu sesión ha vencido. Vuelve a iniciar sesión.'
      : status === 403 ? 'No tienes permiso para realizar esta acción.' : 'No se pudo confirmar la operación. Actualiza la atención antes de intentarlo nuevamente.';
  }
}
