import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ProductoService } from '../../../../core/services/pedido/producto-service';
import { Auth } from '../../../../core/auth/auth';
import { tieneRol } from '../../../../core/auth/access';
import { ProductoResponse } from '../../../../core/models/ProductoModel';

type FiltroEstado = 'ACTIVO' | 'INACTIVO' | 'TODOS';

/**
 * Catálogo de productos compartido.
 * - CLIENTE: ve los activos y tiene acceso a «Crear pedido».
 * - PROGRAMADOR / ANALISTA: ven los activos (solo lectura).
 * - ADMIN: ve también los inactivos y puede crear, editar y desactivar.
 */
@Component({ selector: 'app-catalogo-productos', imports: [RouterLink, DecimalPipe, InputTextModule], templateUrl: './listar-productos.html' })
export class CatalogoProductos {
  private readonly service = inject(ProductoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);
  readonly esCliente = computed(() => this.auth.usuario()?.rol === 'CLIENTE');
  /** Solo ADMIN gestiona el catálogo (POST/PUT/DELETE /productos). */
  readonly puedeGestionar = computed(() => tieneRol(this.auth.usuario()?.rol, 'ADMIN'));
  readonly productos = signal<ProductoResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  /** Error de una acción (desactivar); no oculta el catálogo como el error de carga. */
  readonly errorAccion = signal('');
  readonly busqueda = signal('');
  readonly filtroEstado = signal<FiltroEstado>('ACTIVO');
  readonly confirmarDesactivar = signal<number | null>(null);
  readonly procesando = signal<number | null>(null);
  readonly conteo = computed(() => ({
    ACTIVO: this.productos().filter(p => p.estado === 'ACTIVO').length,
    INACTIVO: this.productos().filter(p => p.estado !== 'ACTIVO').length,
    TODOS: this.productos().length,
  }));
  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase();
    const f = this.filtroEstado();
    return this.productos()
      .filter(p => f === 'TODOS' || (f === 'ACTIVO' ? p.estado === 'ACTIVO' : p.estado !== 'ACTIVO'))
      .filter(p => [p.nombre, p.tipoGas, p.unidadMedida].some(v => v.toLocaleLowerCase().includes(q)));
  });

  constructor() { this.cargar(); }

  cargar() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    const peticion = this.puedeGestionar() ? this.service.todos() : this.service.activos();
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.productos.set(p); this.loading.set(false); },
      error: () => { this.error.set('No se pudo cargar el catálogo. Intenta nuevamente.'); this.loading.set(false); },
    });
  }

  desactivar(p: ProductoResponse) {
    if (!this.puedeGestionar() || this.procesando()) return;
    this.procesando.set(p.idProducto); this.mensaje.set(''); this.errorAccion.set('');
    this.service.desactivar(p.idProducto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.productos.update(lista => lista.map(x => x.idProducto === p.idProducto ? { ...x, estado: 'INACTIVO' } : x));
        this.procesando.set(null); this.confirmarDesactivar.set(null);
        this.mensaje.set(`«${p.nombre}» se desactivó: ya no aparece en el catálogo de clientes ni en nuevos pedidos.`);
      },
      error: (e: HttpErrorResponse) => {
        this.procesando.set(null); this.confirmarDesactivar.set(null);
        this.errorAccion.set(e.status === 403 ? 'Solo el administrador puede desactivar productos.'
          : e.error?.message || 'No se pudo desactivar el producto. Actualiza el catálogo e inténtalo de nuevo.');
      },
    });
  }
}
