import { DestroyRef, Directive, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, forkJoin, of, startWith, switchMap, tap } from 'rxjs';

export interface OpcionEdicion { id: number; etiqueta: string }

/**
 * Base de las pantallas «Editar …» (mismo patrón que Editar pedido del cliente):
 * - /dashboard/<modulo>/editar        → selector con búsqueda para elegir el registro.
 * - /dashboard/<modulo>/:id/editar    → carga ese registro (el botón «Editar» del listado abre esta ruta).
 * Elegir otro registro en el selector cambia la URL, así ambas entradas usan el mismo camino.
 */
@Directive()
export abstract class EdicionBase<T> implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly destroyRef = inject(DestroyRef);
  private readonly recargar$ = new Subject<void>();

  readonly lista = signal<T[]>([]);
  readonly registro = signal<T | null>(null);
  readonly cargando = signal(true);
  readonly cargandoRegistro = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly errorCarga = signal('');
  readonly mensaje = signal('');
  readonly seleccion = new FormControl<number | null>(null);
  readonly opciones = computed<OpcionEdicion[]>(() => {
    const opciones = this.lista().map(x => ({ id: this.idDe(x), etiqueta: this.etiqueta(x) }));
    const actual = this.registro();
    // Un registro abierto por URL que no está en la lista (p. ej. inactivo) se muestra igual en el selector.
    if (actual && !opciones.some(o => o.id === this.idDe(actual))) opciones.unshift({ id: this.idDe(actual), etiqueta: this.etiqueta(actual) });
    return opciones;
  });

  /** Ruta base del módulo, p. ej. '/dashboard/cisternas'. */
  protected abstract readonly rutaBase: string;
  /** Registros que se pueden elegir en el selector. */
  protected abstract listar(): Observable<T[]>;
  /** Registro completo por id. */
  protected abstract buscar(id: number): Observable<T>;
  protected abstract idDe(x: T): number;
  protected abstract etiqueta(x: T): string;
  /** Rellena el formulario con el registro cargado. */
  protected abstract cargarFormulario(x: T): void;
  /** Vacía el formulario cuando no hay registro elegido. */
  protected limpiarFormulario(): void {}

  ngOnInit() {
    this.seleccion.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      if (id && id !== (this.registro() && this.idDe(this.registro()!))) void this.router.navigate([this.rutaBase, id, 'editar']);
    });
    combineLatest([this.route.paramMap, this.recargar$.pipe(startWith(undefined))]).pipe(
      tap(() => { this.errorCarga.set(''); this.cargandoRegistro.set(true); }),
      switchMap(([p]) => this.cargar(p.get('id'))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => { this.cargando.set(false); this.cargandoRegistro.set(false); });
  }

  private cargar(idParam: string | null): Observable<unknown> {
    const lista$ = this.listar().pipe(tap(l => this.lista.set(l)));
    if (idParam === null) {
      this.registro.set(null); this.limpiarFormulario(); this.seleccion.setValue(null, { emitEvent: false });
      return lista$.pipe(catchError(e => { this.errorCarga.set(this.mensajeError(e, 'No se pudo cargar la lista.')); return of(null); }));
    }
    const id = Number(idParam);
    if (!Number.isSafeInteger(id) || id < 1) { this.errorCarga.set('El identificador no es válido.'); return of(null); }
    return forkJoin({ lista: lista$, registro: this.buscar(id) }).pipe(
      tap(({ registro }) => { this.registro.set(registro); this.seleccion.setValue(id, { emitEvent: false }); this.cargarFormulario(registro); }),
      catchError(e => { this.registro.set(null); this.limpiarFormulario(); this.errorCarga.set(this.mensajeError(e, 'No se pudo cargar el registro.')); return of(null); }),
    );
  }

  /** Vuelve a leer el registro desde el backend (tras guardar o al descartar cambios). */
  recargar() { this.recargar$.next(); }

  protected mensajeError(e: HttpErrorResponse, porDefecto: string): string {
    if (e.status === 400) return e.error?.message || (e.error?.details && Object.values(e.error.details).join('. ')) || 'Revisa los datos ingresados.';
    if (e.status === 401) return 'Tu sesión ha vencido. Vuelve a iniciar sesión.';
    if (e.status === 403) return 'Tu rol no tiene permiso para esta acción.';
    if (e.status === 404) return 'El registro no existe.';
    if (e.status === 0) return 'No se pudo conectar con el servidor. Intenta nuevamente.';
    return porDefecto;
  }
}
