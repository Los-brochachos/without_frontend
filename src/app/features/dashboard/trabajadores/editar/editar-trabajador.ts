import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { TrabajadorService } from '../../../../core/services/trabajador/trabajador-service';
import { TrabajadorResponse } from '../../../../core/models/TrabajadorModel';
import { EdicionBase } from '../../compartido/edicion/edicion-base';
import { SelectorEdicion } from '../../compartido/edicion/selector-edicion';
import { CAMPOS_TRABAJADOR, VALIDACION_DATOS_TRABAJADOR } from '../formulario/formulario-trabajador';

/**
 * ADMIN · Trabajadores · Editar trabajador. PUT /trabajadores/{id}.
 * Solo se editan los datos personales; el rol y el correo de acceso se muestran como referencia
 * (GET /trabajadores/{id} no devuelve los datos de especialidad, que se registran al crear).
 */
@Component({ selector: 'app-editar-trabajador', imports: [ReactiveFormsModule, RouterLink, InputTextModule, SelectorEdicion], templateUrl: './editar-trabajador.html' })
export class EditarTrabajador extends EdicionBase<TrabajadorResponse> {
  private readonly service = inject(TrabajadorService);
  protected readonly rutaBase = '/dashboard/trabajadores';
  readonly campos = CAMPOS_TRABAJADOR;
  readonly form = inject(FormBuilder).nonNullable.group({
    nombres: ['', VALIDACION_DATOS_TRABAJADOR.nombres],
    apellidos: ['', VALIDACION_DATOS_TRABAJADOR.apellidos],
    dni: ['', VALIDACION_DATOS_TRABAJADOR.dni],
    telefono: ['', VALIDACION_DATOS_TRABAJADOR.telefono],
    direccion: ['', VALIDACION_DATOS_TRABAJADOR.direccion],
    fechaIngreso: ['', VALIDACION_DATOS_TRABAJADOR.fechaIngreso],
  });

  protected listar() { return this.service.listar(); }
  protected buscar(id: number) { return this.service.buscar(id); }
  protected idDe(t: TrabajadorResponse) { return t.idTrabajador; }
  protected etiqueta(t: TrabajadorResponse) { return `#${t.idTrabajador} · ${t.nombres} ${t.apellidos} · ${t.rol}`; }
  protected cargarFormulario(t: TrabajadorResponse) {
    this.form.reset({ nombres: t.nombres, apellidos: t.apellidos, dni: t.dni, telefono: t.telefono || '', direccion: t.direccion || '', fechaIngreso: t.fechaIngreso });
  }
  protected override limpiarFormulario() { this.form.reset(); }

  invalido(campo: string) { const c = this.form.get(campo); return !!c && c.touched && c.invalid; }

  guardar() {
    const t = this.registro();
    if (!t || this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set(''); this.mensaje.set('');
    if (this.form.invalid) { this.error.set('Revisa los campos obligatorios y sus formatos.'); return; }
    if (!this.form.dirty) { this.mensaje.set('No hay cambios por guardar.'); return; }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.service.actualizar(t.idTrabajador, { nombres: v.nombres.trim(), apellidos: v.apellidos.trim(), dni: v.dni, telefono: v.telefono, direccion: v.direccion.trim(), fechaIngreso: v.fechaIngreso })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.guardando.set(false); this.mensaje.set(`Trabajador #${t.idTrabajador} actualizado.`); this.recargar(); },
        error: (e: HttpErrorResponse) => { this.guardando.set(false); this.error.set(e.status === 409 ? (e.error?.message || 'El DNI ya está registrado.') : this.mensajeError(e, 'No se pudo actualizar el trabajador.')); },
      });
  }
}
