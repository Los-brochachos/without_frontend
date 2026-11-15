import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ProductoService } from '../../../../core/services/pedido/producto-service';
import { ProductoResponse } from '../../../../core/models/ProductoModel';
import { EdicionBase } from '../../compartido/edicion/edicion-base';
import { SelectorEdicion } from '../../compartido/edicion/selector-edicion';
import { VALIDACION_PRODUCTO } from '../formulario/formulario-producto';

/**
 * ADMIN · Productos · Editar producto. PUT /productos/{id}.
 * Rutas: /dashboard/productos/editar (selector) y /dashboard/productos/:id/editar.
 * Los pedidos ya registrados conservan el precio con que se guardaron.
 */
@Component({ selector: 'app-editar-producto', imports: [ReactiveFormsModule, RouterLink, InputTextModule, DecimalPipe, SelectorEdicion], templateUrl: './editar-producto.html' })
export class EditarProducto extends EdicionBase<ProductoResponse> {
  private readonly service = inject(ProductoService);
  protected readonly rutaBase = '/dashboard/productos';
  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', VALIDACION_PRODUCTO.nombre],
    tipoGas: ['', VALIDACION_PRODUCTO.tipoGas],
    unidadMedida: ['', VALIDACION_PRODUCTO.unidadMedida],
    precioUnitario: [null as number | null, VALIDACION_PRODUCTO.precioUnitario],
  });
  /** Vista previa en vivo de la tarjeta del catálogo. */
  readonly vista = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected listar() { return this.service.todos(); }
  protected buscar(id: number) { return this.service.buscar(id); }
  protected idDe(p: ProductoResponse) { return p.idProducto; }
  protected etiqueta(p: ProductoResponse) { return `#${p.idProducto} · ${p.nombre}${p.estado === 'INACTIVO' ? ' (inactivo)' : ''}`; }
  protected cargarFormulario(p: ProductoResponse) {
    this.form.reset({ nombre: p.nombre, tipoGas: p.tipoGas, unidadMedida: p.unidadMedida, precioUnitario: p.precioUnitario });
  }
  protected override limpiarFormulario() { this.form.reset(); }

  campoInvalido(campo: keyof typeof this.form.controls) { const c = this.form.controls[campo]; return c.touched && c.invalid; }

  guardar() {
    const p = this.registro();
    if (!p || this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set(''); this.mensaje.set('');
    if (this.form.invalid) { this.error.set('Revisa los campos marcados.'); return; }
    if (!this.form.dirty) { this.mensaje.set('No hay cambios por guardar.'); return; }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.service.actualizar(p.idProducto, { nombre: v.nombre.trim(), tipoGas: v.tipoGas.trim(), unidadMedida: v.unidadMedida.trim(), precioUnitario: Number(v.precioUnitario) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.guardando.set(false); this.mensaje.set(`Producto #${p.idProducto} actualizado.`); this.recargar(); },
        error: (e: HttpErrorResponse) => { this.guardando.set(false); this.error.set(this.mensajeError(e, 'No se pudo guardar el producto.')); },
      });
  }
}
