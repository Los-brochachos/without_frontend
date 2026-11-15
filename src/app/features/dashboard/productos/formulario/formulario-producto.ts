import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ProductoService } from '../../../../core/services/pedido/producto-service';

/** Validaciones iguales a ProductoCreateRequest del backend (las usan Crear y Editar producto). */
export const VALIDACION_PRODUCTO = {
  nombre: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
  tipoGas: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)],
  unidadMedida: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)],
  precioUnitario: [Validators.required, Validators.min(0.01), Validators.max(99999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)],
};

/**
 * ADMIN · Productos · Crear producto. Ruta: /dashboard/productos/nuevo (roles: ['ADMIN']).
 * La edición tiene su propia pantalla (productos/editar/editar-producto). El nombre repetido lo rechaza el backend (400).
 */
@Component({ selector: 'app-formulario-producto', imports: [ReactiveFormsModule, RouterLink, InputTextModule, DecimalPipe], templateUrl: './formulario-producto.html' })
export class FormularioProducto {
  private readonly service = inject(ProductoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly guardando = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', VALIDACION_PRODUCTO.nombre],
    tipoGas: ['', VALIDACION_PRODUCTO.tipoGas],
    unidadMedida: ['', VALIDACION_PRODUCTO.unidadMedida],
    precioUnitario: [null as number | null, VALIDACION_PRODUCTO.precioUnitario],
  });
  /** Vista previa en vivo de la tarjeta del catálogo. */
  readonly vista = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

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
    this.guardando.set(true);
    this.service.crear(datos).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
