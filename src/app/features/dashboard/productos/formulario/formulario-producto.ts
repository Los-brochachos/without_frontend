import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ProductoService } from '../../../../core/services/pedido/producto-service';
import { ProductoResponse } from '../../../../core/models/ProductoModel';

/**
 * ADMIN · Crear / editar producto.
 * Rutas: /dashboard/productos/nuevo  y  /dashboard/productos/:id/editar (roles: ['ADMIN'] en app.routes).
 * Validaciones iguales a ProductoCreateRequest del backend; el nombre repetido lo rechaza el backend (400).
 */
@Component({ selector: 'app-formulario-producto', imports: [ReactiveFormsModule, RouterLink, InputTextModule, DecimalPipe], templateUrl: './formulario-producto.html' })
export class FormularioProducto {
  private readonly service = inject(ProductoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly idEdicion = signal<number | null>(null);
  readonly original = signal<ProductoResponse | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly errorCarga = signal('');
  readonly esEdicion = computed(() => this.idEdicion() !== null);

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    tipoGas: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    unidadMedida: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)]],
    precioUnitario: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(99999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
  });
  /** Vista previa en vivo de la tarjeta del catálogo. */
  readonly vista = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (this.route.snapshot.paramMap.has('id')) {
      if (!Number.isSafeInteger(id) || id < 1) { this.errorCarga.set('El identificador del producto no es válido.'); return; }
      this.idEdicion.set(id);
      this.cargando.set(true);
      this.service.buscar(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: p => {
          this.original.set(p);
          this.form.setValue({ nombre: p.nombre, tipoGas: p.tipoGas, unidadMedida: p.unidadMedida, precioUnitario: p.precioUnitario });
          this.cargando.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.cargando.set(false);
          this.errorCarga.set(e.status === 404 ? 'El producto no existe.' : e.status === 403 ? 'Solo el administrador puede editar productos.' : 'No se pudo cargar el producto.');
        },
      });
    }
  }

  campoInvalido(campo: keyof typeof this.form.controls) {
    const c = this.form.controls[campo];
    return c.touched && c.invalid;
  }

  guardar() {
    if (this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set('');
    if (this.form.invalid) { this.error.set('Revisa los campos marcados.'); return; }
    const v = this.form.getRawValue();
    const datos = { nombre: v.nombre.trim(), tipoGas: v.tipoGas.trim(), unidadMedida: v.unidadMedida.trim(), precioUnitario: Number(v.precioUnitario) };
    const id = this.idEdicion();
    this.guardando.set(true);
    (id === null ? this.service.crear(datos) : this.service.actualizar(id, datos)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.guardando.set(false); void this.router.navigate(['/dashboard/productos']); },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        const detalles = e.error?.details;
        this.error.set(e.status === 400 ? (e.error?.message || (detalles && Object.values(detalles).join('. ')) || 'Revisa los datos del producto.')
          : e.status === 403 ? 'Solo el administrador puede gestionar productos.'
          : e.status === 401 ? 'Tu sesión ha vencido. Vuelve a iniciar sesión.'
          : 'No se pudo guardar el producto. Inténtalo nuevamente.');
      },
    });
  }
}
