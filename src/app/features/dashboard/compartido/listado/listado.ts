import { Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { PortalPreferencias } from '../../../../core/services/portal-preferencias';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { Auth } from '../../../../core/auth/auth';
import { ApiService } from '../../../../core/services/api.service';
import { PaginaResponse, paramsPagina } from '../../../../core/models/PaginaModel';
import { DASHBOARD_ROLES, DashboardSection } from '../../dashboard-data';

type Row = Record<string, unknown>;
/** Resultado normalizado: en modo servidor trae los totales del backend. */
interface Resultado { rows: Row[]; servidor: Omit<PaginaResponse<Row>, 'contenido'> | null }
export const TAMANIO_PAGINA = 10;

@Component({ selector: 'app-listado', imports: [InputTextModule, RouterLink], templateUrl: './listado.html' })
export class Listado {
  private readonly auth = inject(Auth);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preferencias = inject(PortalPreferencias);
  private readonly locale = inject(LOCALE_ID);
  private readonly reload = new Subject<void>();
  readonly section = signal<DashboardSection | null>(null);
  readonly rows = signal<Row[]>([]);
  /** Metadatos de la última página recibida del backend (null en modo local). */
  readonly servidor = signal<Resultado['servidor']>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly estado = signal('');
  readonly requestedPage = signal(1);
  readonly back = this.auth.usuario()?.rol === 'CLIENTE' ? '/cliente/inicio' : '/dashboard';
  readonly isClientOrders = computed(() => this.auth.usuario()?.rol === 'CLIENTE' && this.section()?.key === 'pedidos');
  readonly canSchedule = computed(() => this.auth.usuario()?.rol === 'PROGRAMADOR' && ['pedidos', 'atenciones'].includes(this.section()?.key ?? ''));
  readonly isDriverAttendances = computed(() => this.auth.usuario()?.rol === 'CONDUCTOR' && this.section()?.key === 'atenciones');
  readonly canEditAttendances = computed(() => this.auth.usuario()?.rol === 'PROGRAMADOR' && this.section()?.key === 'atenciones');
  /** true cuando el backend pagina (pedidos); false cuando se pagina en memoria. */
  readonly paginadoServidor = computed(() => !!this.section()?.pagedPath);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase();
    return this.rows().filter(row => !q || this.section()?.columns.some(column => this.value(row, column.key).toLocaleLowerCase().includes(q)));
  });
  readonly pages = computed(() => this.servidor()
    ? Math.max(1, this.servidor()!.totalPaginas)
    : Math.max(1, Math.ceil(this.filtered().length / TAMANIO_PAGINA)));
  readonly page = computed(() => Math.min(this.requestedPage(), this.pages()));
  /** En modo servidor la página ya viene recortada: solo se aplica la búsqueda local. */
  readonly visible = computed(() => this.servidor()
    ? this.filtered()
    : this.filtered().slice((this.page() - 1) * TAMANIO_PAGINA, this.page() * TAMANIO_PAGINA));
  readonly total = computed(() => this.servidor()?.totalElementos ?? this.filtered().length);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.query.set(params.get('q') ?? '');
      this.estado.set(params.get('estado') ?? '');
      this.requestedPage.set(this.leerPagina(params.get('pagina')));
    });

    let recarga = 0;
    combineLatest([this.route.data, this.route.queryParamMap, this.reload.pipe(startWith(undefined), map(() => recarga++))]).pipe(
      map(([data, params, n]) => {
        const section = DASHBOARD_ROLES[this.auth.usuario()?.rol ?? '']?.sections.find(s => s.key === data['sectionKey']) ?? null;
        const servidor = !!section?.pagedPath;
        // En modo local cambiar de página/búsqueda NO vuelve a consultar; en modo servidor sí.
        return { section, n, pagina: servidor ? this.leerPagina(params.get('pagina')) : 1, estado: servidor ? params.get('estado') ?? '' : '' };
      }),
      distinctUntilChanged((a, b) => a.section === b.section && a.n === b.n && a.pagina === b.pagina && a.estado === b.estado),
      tap(({ section }) => { this.section.set(section); this.error.set(''); this.loading.set(true); }),
      switchMap(({ section, pagina, estado }) => {
        if (!section) { this.error.set('No tienes acceso a este módulo.'); return of<Resultado>({ rows: [], servidor: null }); }
        return this.consultar(section, pagina, estado).pipe(catchError(error => {
          this.error.set(error.status === 403 ? 'No tienes permiso para consultar esta información.'
            : error.status === 401 ? 'Tu sesión ha vencido. Vuelve a iniciar sesión.'
            : error.status === 400 ? 'Los filtros de la consulta no son válidos.'
            : 'No se pudo cargar la información. Intenta actualizar.');
          return of<Resultado>({ rows: [], servidor: null });
        }));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ rows, servidor }) => {
      this.rows.set(rows); this.servidor.set(servidor); this.loading.set(false);
      // Si la URL pide una página que ya no existe (p. ej. ?pagina=99), se salta a la última.
      if (servidor && servidor.totalPaginas > 0 && this.requestedPage() > servidor.totalPaginas) this.changePage(servidor.totalPaginas);
    });
  }

  private consultar(section: DashboardSection, pagina: number, estado: string): Observable<Resultado> {
    if (!section.pagedPath) return this.api.get<Row[]>(section.path).pipe(map(rows => ({ rows, servidor: null })));
    // La UI numera desde 1; Spring Data desde 0.
    return this.api.get<PaginaResponse<Row>>(`${section.pagedPath}?${paramsPagina(pagina - 1, TAMANIO_PAGINA, { estado })}`)
      .pipe(map(({ contenido, ...meta }) => ({ rows: contenido, servidor: meta })));
  }
  private leerPagina(valor: string | null) {
    const page = Number(valor);
    return Number.isSafeInteger(page) && page > 0 ? page : 1;
  }
  filter(query: string) {
    this.query.set(query);
    // En modo servidor la búsqueda filtra la página actual: no reinicia la paginación.
    this.navigate({ q: query || null, pagina: this.paginadoServidor() && this.page() > 1 ? this.page() : null });
  }
  filtrarEstado(estado: string) { this.navigate({ estado: estado || null, pagina: null }); }
  changePage(page: number) { this.navigate({ pagina: page > 1 ? page : null }); }
  private navigate(queryParams: Record<string, string | number | null>) {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
  refresh() { if (!this.loading()) this.reload.next(); }
  value(row: Row, key: string): string {
    const value = row[key];
    if (value === null || value === undefined || value === '') return '—';
    // Columnas de fecha: se muestran con el formato elegido en Preferencias.
    if (key.startsWith('fecha') && typeof value === 'string' && /^d{4}-d{2}-d{2}/.test(value))
      return formatDate(value, value.includes('T') ? this.preferencias.formatoHora() : this.preferencias.formato(), this.locale);
    return String(value);
  }
}
