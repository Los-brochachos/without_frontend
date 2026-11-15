import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, combineLatest, concat, forkJoin, map, of, startWith, switchMap, tap, toArray } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { SelectorEdicion } from '../../compartido/edicion/selector-edicion';
import { PedidoService } from '../../../../core/services/pedido/pedido-service';
import { ProductoService } from '../../../../core/services/pedido/producto-service';
import { DetallePedidoService } from '../../../../core/services/pedido/detalle-pedido-service';
import { DetallePedidoResponse, PedidoResponse } from '../../../../core/models/PedidoModel';
import { ProductoResponse } from '../../../../core/models/ProductoModel';

const CANTIDAD = [Validators.required, Validators.min(0.01), Validators.max(99999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)];
const redondear = (n: number) => Math.round(n * 100) / 100;

/** El backend solo permite AUMENTAR la cantidad de un producto ya registrado. */
function noMenorQueOriginal(grupo: AbstractControl): ValidationErrors | null {
  const original = grupo.get('cantidadOriginal')?.value as number | null;
  const cantidad = Number(grupo.get('cantidad')?.value);
  return original !== null && Number.isFinite(cantidad) && cantidad < original ? { menorQueOriginal: original } : null;
}

interface OpcionPedido { id: number; etiqueta: string }

/**
 * Cliente · Pedidos · Editar pedido.
 * Mismo formulario que «Crear pedido», con un selector (con búsqueda por ID) arriba.
 * Solo se pueden editar pedidos en estado RECIBIDO (regla del backend).
 */
@Component({ selector: 'app-editar-pedido', imports: [RouterLink, DecimalPipe, ReactiveFormsModule, InputTextModule, SelectorEdicion], templateUrl: './editar-pedido.html' })
export class EditarPedido {
  private readonly pedidosApi = inject(PedidoService);
  private readonly catalogo = inject(ProductoService);
  private readonly detallesApi = inject(DetallePedidoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly reload = new Subject<void>();
  /** Error de guardado que debe seguir visible después de recargar el pedido. */
  private errorTrasRecarga = '';

  readonly cargando = signal(true);
  readonly cargandoPedido = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly editables = signal<PedidoResponse[]>([]);
  readonly productos = signal<ProductoResponse[]>([]);
  readonly pedido = signal<PedidoResponse | null>(null);
  /** Detalles tal como están guardados; base para calcular los cambios. */
  private readonly originales = signal<DetallePedidoResponse[]>([]);

  readonly editable = computed(() => this.pedido()?.estado === 'RECIBIDO');
  readonly opciones = computed<OpcionPedido[]>(() => {
    const lista = this.editables().map(p => ({ id: p.idPedido, etiqueta: `Pedido #${p.idPedido} · Entrega ${p.fechaEntregaEstimada} · ${p.prioridad}` }));
    const actual = this.pedido();
    // Si se abrió por URL un pedido no editable, se muestra igual en el selector.
    if (actual && !lista.some(o => o.id === actual.idPedido)) lista.unshift({ id: actual.idPedido, etiqueta: `Pedido #${actual.idPedido} · ${actual.estado} (no editable)` });
    return lista;
  });

  readonly seleccion = this.fb.control<number | null>(null);
  readonly form = this.fb.group({ detalles: this.fb.array<ReturnType<EditarPedido['linea']>>([]) });
  get detalles() { return this.form.controls.detalles; }

  private readonly borrador = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly resumen = computed(() => {
    this.borrador(); // se recalcula con cada cambio del formulario
    return this.detalles.getRawValue().map(l => {
      const producto = this.producto(l.idProducto);
      const cantidad = Number(l.cantidad);
      // Un producto ya registrado conserva el precio con que se guardó.
      const precio = this.originales().find(o => o.idDetalle === l.idDetalle)?.precioUnitario ?? producto?.precioUnitario ?? 0;
      return { producto, cantidad, importe: producto && cantidad > 0 ? redondear(precio * cantidad) : 0 };
    }).filter(l => !!l.producto);
  });
  readonly totalEstimado = computed(() => this.resumen().reduce((t, l) => t + l.importe, 0));
  /** Lista legible de lo que se enviará al guardar. */
  readonly cambios = computed(() => { this.borrador(); this.originales(); return this.calcularCambios().map(c => c.texto); });

  constructor() {
    // Selector → URL (así el botón «Editar» del listado y el selector usan la misma ruta).
    this.seleccion.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      if (id && id !== this.pedido()?.idPedido) void this.router.navigate(['/cliente/pedidos', id, 'editar']);
    });

    combineLatest([this.route.paramMap, this.reload.pipe(startWith(undefined))]).pipe(
      tap(() => { this.error.set(''); this.cargandoPedido.set(true); }),
      switchMap(([params]) => this.cargar(params.get('id'))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.cargando.set(false); this.cargandoPedido.set(false);
      if (this.errorTrasRecarga) { this.error.set(this.errorTrasRecarga); this.errorTrasRecarga = ''; }
    });
  }

  private cargar(idParam: string | null): Observable<unknown> {
    const base$ = forkJoin({
      editables: this.pedidosApi.misPedidosPaginado(0, 50, 'RECIBIDO').pipe(map(p => p.contenido)),
      productos: this.catalogo.activos(),
    }).pipe(tap(r => { this.editables.set(r.editables); this.productos.set(r.productos); }));

    if (idParam === null) {
      this.pedido.set(null); this.originales.set([]); this.detalles.clear(); this.seleccion.setValue(null, { emitEvent: false });
      return base$.pipe(catchError(e => { this.error.set(this.mensajeError(e, 'No se pudieron cargar tus pedidos.')); return of(null); }));
    }
    const id = Number(idParam);
    if (!Number.isSafeInteger(id) || id < 1) { this.error.set('El identificador del pedido no es válido.'); return of(null); }
    return forkJoin({ base: base$, pedido: this.pedidosApi.miPedido(id), detalles: this.pedidosApi.detallesPropios(id) }).pipe(
      tap(({ pedido, detalles }) => this.cargarFormulario(pedido, detalles)),
      catchError(e => { this.pedido.set(null); this.detalles.clear(); this.error.set(this.mensajeError(e, 'No se pudo cargar el pedido.')); return of(null); }));
  }

  private cargarFormulario(pedido: PedidoResponse, detalles: DetallePedidoResponse[]) {
    this.pedido.set(pedido); this.originales.set(detalles);
    this.seleccion.setValue(pedido.idPedido, { emitEvent: false });
    this.detalles.clear();
    detalles.forEach(d => this.detalles.push(this.linea(d)));
    if (pedido.estado === 'RECIBIDO') {
      this.form.enable();
      // enable() reactiva todo: los productos ya registrados siguen bloqueados.
      this.detalles.controls.forEach(l => { if (l.controls.idDetalle.value !== null) l.controls.idProducto.disable(); });
    } else this.form.disable();
  }

  private linea(d?: DetallePedidoResponse) {
    const grupo = this.fb.group({
      idDetalle: this.fb.control<number | null>(d?.idDetalle ?? null),
      cantidadOriginal: this.fb.control<number | null>(d?.cantidad ?? null),
      idProducto: this.fb.control<number | null>(d?.idProducto ?? null, Validators.required),
      cantidad: this.fb.control<number | null>(d?.cantidad ?? null, CANTIDAD),
    }, { validators: noMenorQueOriginal });
    // Un producto ya registrado no se cambia por otro: se quita y se agrega uno nuevo.
    if (d) grupo.controls.idProducto.disable();
    return grupo;
  }

  producto(id: number | null) { return this.productos().find(p => p.idProducto === id); }
  esExistente(i: number) { return this.detalles.at(i).controls.idDetalle.value !== null; }
  ocupado(id: number, indice: number) { return this.detalles.controls.some((l, i) => i !== indice && l.controls.idProducto.value === id); }
  agregar() { this.detalles.push(this.linea()); }
  quitar(i: number) { if (this.detalles.length > 1) this.detalles.removeAt(i); }
  descartar() { if (!this.guardando()) { this.mensaje.set(''); this.reload.next(); } }

  /** Diferencia entre el formulario y lo guardado → operaciones del backend. */
  private calcularCambios() {
    const p = this.pedido(); if (!p) return [];
    const lineas = this.detalles.getRawValue();
    const agregar = lineas.filter(l => l.idDetalle === null && l.idProducto !== null && Number(l.cantidad) > 0).map(l => ({
      texto: `Agregar ${this.producto(l.idProducto)?.nombre ?? 'producto'} × ${Number(l.cantidad)}`,
      peticion: this.detallesApi.agregar(p.idPedido, l.idProducto!, Number(l.cantidad)),
    }));
    const aumentar = lineas.filter(l => l.idDetalle !== null && Number(l.cantidad) > (l.cantidadOriginal ?? 0)).map(l => {
      const delta = redondear(Number(l.cantidad) - (l.cantidadOriginal ?? 0));
      return { texto: `Sumar ${delta} a ${this.producto(l.idProducto)?.nombre ?? 'producto'}`, peticion: this.detallesApi.aumentarCantidad(p.idPedido, l.idDetalle!, delta) };
    });
    const quitar = this.originales().filter(o => !lineas.some(l => l.idDetalle === o.idDetalle)).map(o => ({
      texto: `Quitar ${o.nombreProducto}`, peticion: this.detallesApi.quitar(p.idPedido, o.idDetalle),
    }));
    // Orden importante: primero agregar/aumentar y al final quitar (el pedido nunca queda vacío).
    return [...agregar, ...aumentar, ...quitar];
  }

  guardar() {
    if (this.guardando() || !this.editable()) return;
    this.error.set(''); this.mensaje.set(''); this.form.markAllAsTouched();
    if (this.form.invalid) { this.error.set('Revisa los productos: completa los campos y no reduzcas cantidades ya registradas.'); return; }
    const ids = this.detalles.getRawValue().map(l => l.idProducto);
    if (new Set(ids).size !== ids.length) { this.error.set('Un producto no puede repetirse dentro del mismo pedido.'); return; }
    const cambios = this.calcularCambios();
    if (!cambios.length) { this.mensaje.set('No hay cambios por guardar.'); return; }

    this.guardando.set(true);
    const id = this.pedido()!.idPedido;
    concat(...cambios.map(c => c.peticion)).pipe(toArray(), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.guardando.set(false); this.mensaje.set(`Pedido #${id} actualizado (${cambios.length} cambio${cambios.length > 1 ? 's' : ''}).`); this.reload.next(); },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        // Puede haberse aplicado una parte: se recarga para mostrar el estado real.
        this.errorTrasRecarga = this.mensajeError(e, 'No se pudieron guardar todos los cambios.') + ' Se recargó el pedido con lo que quedó guardado.';
        this.reload.next();
      },
    });
  }

  private mensajeError(e: HttpErrorResponse, porDefecto: string): string {
    if (e.status === 400) return e.error?.message || (e.error?.details && Object.values(e.error.details).join('. ')) || 'Revisa los datos ingresados.';
    if (e.status === 401) return 'Tu sesión ha vencido. Vuelve a iniciar sesión.';
    if (e.status === 403) return 'No tienes permiso para modificar este pedido.';
    if (e.status === 404) return 'El pedido no existe o no pertenece a tu cuenta.';
    if (e.status === 0) return 'No se pudo conectar con el servidor. Intenta nuevamente.';
    return porDefecto;
  }
}
