import { DestroyRef, Directive, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, distinctUntilChanged, map, of, startWith, switchMap, tap, combineLatest } from 'rxjs';
import { Auth } from '../../../../core/auth/auth';
import { homeForRole } from '../../../../core/auth/access';
import { ApiService } from '../../../../core/services/api.service';
import { PaginaResponse, paramsPagina } from '../../../../core/models/PaginaModel';

export const TAMANIO_PAGINA = 10;

/** De dónde sale el listado: endpoint normal (se pagina en memoria) o paginado (lo pagina el backend). */
export interface FuenteListado { path: string; paginado?: boolean }

type Meta = Omit<PaginaResponse<unknown>, 'contenido'>;

/**
 * Lógica común de los listados del dashboard (cada módulo tiene su propio componente y su propio HTML):
 * - Búsqueda, estado y página viven en la URL (?q=&estado=&pagina=), así F5 o «Volver» conservan los filtros.
 * - Modo memoria: se consulta una vez y se filtra/pagina en el navegador.
 * - Modo servidor (fuente.paginado): cada página o cambio de estado se pide al backend (PaginaResponse).
 */
@Directive()
export abstract class ListadoBase<T> implements OnInit {
  protected readonly api = inject(ApiService);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(Auth);
  private readonly recarga = new Subject<void>();

  readonly filas = signal<T[]>([]);
  /** Metadatos de la última página del backend (null en modo memoria). */
  readonly servidor = signal<Meta | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly consulta = signal('');
  readonly estado = signal('');
  readonly paginaSolicitada = signal(1);
  readonly volver = homeForRole(this.auth.usuario()?.rol);
  /** Mensaje de éxito enviado por un formulario al volver al listado (router state `aviso`). */
  readonly aviso = signal<string>(typeof history !== 'undefined' ? history.state?.aviso ?? '' : '');
  /** Rol del usuario autenticado (para mostrar acciones solo a quien puede usarlas). */
  readonly rolActual = this.auth.usuario()?.rol ?? '';

  /** Endpoint del módulo (bajo /api/v1). */
  protected abstract fuente(): FuenteListado;
  /** true si la fila contiene el texto buscado (ya en minúsculas). */
  protected abstract coincide(fila: T, texto: string): boolean;
  /** Valor usado por el filtro de estado en modo memoria. */
  protected estadoDe(fila: T): string | undefined { return (fila as { estado?: string }).estado; }
  /** Filtro adicional propio del módulo (p. ej. rol en Usuarios). */
  protected filtroExtra(_fila: T): boolean { return true; }

  get paginadoServidor(): boolean { return !!this.fuente().paginado; }

  readonly filtrados = computed(() => {
    const texto = this.consulta().trim().toLocaleLowerCase();
    const estado = this.servidor() ? '' : this.estado();
    return this.filas().filter(f => (!estado || this.estadoDe(f) === estado) && this.filtroExtra(f) && (!texto || this.coincide(f, texto)));
  });
  readonly paginas = computed(() => this.servidor()
    ? Math.max(1, this.servidor()!.totalPaginas)
    : Math.max(1, Math.ceil(this.filtrados().length / TAMANIO_PAGINA)));
  readonly pagina = computed(() => Math.min(this.paginaSolicitada(), this.paginas()));
  /** En modo servidor la página ya viene recortada: solo se aplica la búsqueda local. */
  readonly visibles = computed(() => this.servidor()
    ? this.filtrados()
    : this.filtrados().slice((this.pagina() - 1) * TAMANIO_PAGINA, this.pagina() * TAMANIO_PAGINA));
  readonly total = computed(() => this.servidor()?.totalElementos ?? this.filtrados().length);

  ngOnInit(): void {
    const servidor = this.paginadoServidor;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      this.consulta.set(p.get('q') ?? '');
      this.estado.set(p.get('estado') ?? '');
      this.paginaSolicitada.set(this.leerPagina(p.get('pagina')));
    });
    let n = 0;
    combineLatest([this.route.queryParamMap, this.recarga.pipe(startWith(undefined), map(() => n++))]).pipe(
      // En modo memoria cambiar página/búsqueda NO vuelve a consultar; en modo servidor sí.
      map(([p, vez]) => ({ vez, pagina: servidor ? this.leerPagina(p.get('pagina')) : 1, estado: servidor ? p.get('estado') ?? '' : '' })),
      distinctUntilChanged((a, b) => a.vez === b.vez && a.pagina === b.pagina && a.estado === b.estado),
      tap(() => { this.cargando.set(true); this.error.set(''); }),
      switchMap(({ pagina, estado }) => this.consultar(pagina, estado).pipe(catchError(e => {
        this.error.set(this.mensajeError(e.status));
        return of({ filas: [] as T[], meta: null });
      }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ filas, meta }) => {
      this.filas.set(filas); this.servidor.set(meta); this.cargando.set(false);
      // Si la URL pide una página que ya no existe (p. ej. ?pagina=99), se salta a la última.
      if (meta && meta.totalPaginas > 0 && this.paginaSolicitada() > meta.totalPaginas) this.cambiarPagina(meta.totalPaginas);
    });
  }

  private consultar(pagina: number, estado: string): Observable<{ filas: T[]; meta: Meta | null }> {
    const { path, paginado } = this.fuente();
    if (!paginado) return this.api.get<T[]>(path).pipe(map(filas => ({ filas, meta: null })));
    // La UI numera desde 1; Spring Data desde 0.
    return this.api.get<PaginaResponse<T>>(`${path}?${paramsPagina(pagina - 1, TAMANIO_PAGINA, { estado })}`)
      .pipe(map(({ contenido, ...meta }) => ({ filas: contenido, meta })));
  }
  protected mensajeError(status: number): string {
    return status === 403 ? 'No tienes permiso para consultar esta información.'
      : status === 401 ? 'Tu sesión ha vencido. Vuelve a iniciar sesión.'
      : status === 400 ? 'Los filtros de la consulta no son válidos.'
      : 'No se pudo cargar la información. Intenta actualizar.';
  }
  private leerPagina(valor: string | null) {
    const n = Number(valor);
    return Number.isSafeInteger(n) && n > 0 ? n : 1;
  }

  buscar(texto: string) {
    // En modo servidor la búsqueda filtra la página actual: no reinicia la paginación.
    this.navegar({ q: texto || null, pagina: this.paginadoServidor && this.pagina() > 1 ? this.pagina() : null });
  }
  filtrarEstado(estado: string) { this.navegar({ estado: estado || null, pagina: null }); }
  cambiarPagina(pagina: number) { this.navegar({ pagina: pagina > 1 ? pagina : null }); }
  actualizar() { if (!this.cargando()) this.recarga.next(); }
  private navegar(queryParams: Record<string, string | number | null>) {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Clases del distintivo de estado (mismos colores en todos los módulos). */
  claseEstado(estado: string | null | undefined): string {
    switch (estado) {
      case 'ACTIVO': case 'ENTREGADO': case 'FINALIZADA': case 'ATENDIDA': case 'RESUELTA': case 'DISPONIBLE':
        return 'bg-emerald-50 text-emerald-700';
      case 'RECIBIDO': case 'PROGRAMADA': case 'REPORTADA': case 'PENDIENTE':
        return 'bg-sky-50 text-[#0077cc]';
      case 'EN_PREPARACION': case 'EN_CURSO': case 'DESPACHADO': case 'EN_REPARACION': case 'REVISADA':
        return 'bg-amber-50 text-amber-700';
      case 'INACTIVO': case 'CANCELADO': case 'CANCELADA':
        return 'bg-red-50 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }
  texto(valor: string | null | undefined): string { return valor ? valor.replaceAll('_', ' ') : '—'; }
}
