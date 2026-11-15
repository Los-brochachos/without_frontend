import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { AlertaService } from '../../../../core/services/atencion/alerta-service';
import { Auth } from '../../../../core/auth/auth';
import { tieneRol } from '../../../../core/auth/access';
import { AlertaResponse, EstadoAlerta, TIPOS_ALERTA } from '../../../../core/models/AlertaModel';

type Filtro = EstadoAlerta | 'TODAS';
const ORDEN: Record<EstadoAlerta, number> = { PENDIENTE: 0, REVISADA: 1, ATENDIDA: 2 };
const POR_PAGINA = 10;

/**
 * Alertas de operación (compartida). La ven ADMIN, ANALISTA, PROGRAMADOR y CONDUCTOR;
 * solo PROGRAMADOR puede cambiar su estado (el backend lo exige: PATCH /revisar y /atender).
 * Flujo (regla del backend): PENDIENTE → «Marcar revisada» → REVISADA → «Marcar atendida» → ATENDIDA.
 */
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
@Component({ selector: 'app-alertas-operacion', imports: [FechaPipe, RouterLink, InputTextModule], templateUrl: './listar-alertas.html' })
export class AlertasOperacion {
  private readonly service = inject(AlertaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);
  /** Solo el programador gestiona alertas; los demás roles las consultan. */
  readonly puedeGestionar = computed(() => tieneRol(this.auth.usuario()?.rol, 'PROGRAMADOR'));
  /** El conductor solo ve las alertas de SUS atenciones (GET /alertas/mis-alertas). */
  readonly esConductor = computed(() => this.auth.usuario()?.rol === 'CONDUCTOR');

  readonly tipos: Record<string, string> = TIPOS_ALERTA;
  readonly alertas = signal<AlertaResponse[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly procesando = signal<number | null>(null);
  // Quien gestiona arranca en «Pendientes» (lo que requiere acción); quien consulta ve todas.
  readonly filtro = signal<Filtro>(this.auth.usuario()?.rol === 'PROGRAMADOR' ? 'PENDIENTE' : 'TODAS');
  readonly consulta = signal('');
  readonly pagina = signal(1);

  readonly conteo = computed(() => {
    const c = { TODAS: this.alertas().length, PENDIENTE: 0, REVISADA: 0, ATENDIDA: 0 };
    this.alertas().forEach(a => c[a.estado]++);
    return c;
  });
  readonly filtradas = computed(() => {
    const q = this.consulta().trim().toLocaleLowerCase();
    return this.alertas()
      .filter(a => this.filtro() === 'TODAS' || a.estado === this.filtro())
      .filter(a => !q || [a.idAlerta, a.idAtencion, a.mensaje, this.tipos[a.tipo] ?? a.tipo].some(v => String(v).toLocaleLowerCase().includes(q)))
      // Primero lo que requiere acción; dentro de cada estado, lo más reciente.
      .sort((x, y) => ORDEN[x.estado] - ORDEN[y.estado] || y.fechaHora.localeCompare(x.fechaHora));
  });
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / POR_PAGINA)));
  readonly actual = computed(() => Math.min(this.pagina(), this.paginas()));
  readonly visibles = computed(() => this.filtradas().slice((this.actual() - 1) * POR_PAGINA, this.actual() * POR_PAGINA));

  constructor() { this.cargar(); }

  /** @param conservarError true cuando se recarga tras un rechazo, para no ocultar el motivo. */
  cargar(conservarError = false) {
    this.cargando.set(true); if (!conservarError) this.error.set('');
    (this.esConductor() ? this.service.misAlertas() : this.service.listar()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alertas => { this.alertas.set(alertas); this.cargando.set(false); },
      error: (e: HttpErrorResponse) => { this.error.set(this.mensajeError(e, 'No se pudieron cargar las alertas.')); this.cargando.set(false); },
    });
  }
  filtrar(f: Filtro) { this.filtro.set(f); this.pagina.set(1); }
  buscar(q: string) { this.consulta.set(q); this.pagina.set(1); }

  revisar(a: AlertaResponse) { this.cambiarEstado(a, 'revisar'); }
  atender(a: AlertaResponse) { this.cambiarEstado(a, 'atender'); }

  private cambiarEstado(a: AlertaResponse, accion: 'revisar' | 'atender') {
    if (this.procesando() || !this.puedeGestionar()) return;
    this.procesando.set(a.idAlerta); this.error.set(''); this.mensaje.set('');
    const peticion = accion === 'revisar' ? this.service.marcarRevisada(a.idAlerta) : this.service.marcarAtendida(a.idAlerta);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: actualizada => {
        this.alertas.update(lista => lista.map(x => x.idAlerta === actualizada.idAlerta ? actualizada : x));
        this.procesando.set(null);
        this.mensaje.set(`Alerta #${actualizada.idAlerta} marcada como ${actualizada.estado === 'REVISADA' ? 'revisada' : 'atendida'}.`);
      },
      error: (e: HttpErrorResponse) => {
        this.procesando.set(null);
        this.error.set(this.mensajeError(e, 'No se pudo actualizar la alerta.'));
        // Otro programador pudo haberla cambiado: se refresca para ver el estado real.
        if (e.status === 400 || e.status === 404) this.cargar(true);
      },
    });
  }

  private mensajeError(e: HttpErrorResponse, porDefecto: string) {
    if (e.status === 400) return e.error?.message || porDefecto;
    if (e.status === 401) return 'Tu sesión ha vencido. Vuelve a iniciar sesión.';
    if (e.status === 403) return 'Solo el programador puede gestionar alertas.';
    if (e.status === 404) return 'La alerta ya no existe.';
    if (e.status === 0) return 'No se pudo conectar con el servidor.';
    return porDefecto;
  }
}
