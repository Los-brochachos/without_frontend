import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { ClienteService } from '../../../../core/services/cliente/cliente-service';
import { ClienteResponse } from '../../../../core/models/ClienteModel';
import { Alertas } from '../../../../core/ui/alerta-modal/alertas';
import { EdicionBase } from '../../compartido/edicion/edicion-base';
import { SelectorEdicion } from '../../compartido/edicion/selector-edicion';

/**
 * ADMIN · Clientes · Editar cliente. PUT /clientes/{id} (datos de la empresa).
 * - Dar de baja: DELETE /clientes/{id} (la cuenta queda INACTIVA, sus datos se conservan).
 * - Reactivar: PATCH /usuarios/{idUsuario}/activar.
 * El correo de acceso no se cambia aquí: lo cambia el propio cliente en Seguridad o el SUPERADMIN en Usuarios.
 */
@Component({ selector: 'app-editar-cliente', imports: [ReactiveFormsModule, RouterLink, InputTextModule, SelectorEdicion], templateUrl: './editar-cliente.html' })
export class EditarCliente extends EdicionBase<ClienteResponse> {
  private readonly service = inject(ClienteService);
  private readonly alertas = inject(Alertas);
  protected readonly rutaBase = '/dashboard/clientes';
  /** Mismas reglas que el registro y el perfil del cliente. */
  readonly form = inject(FormBuilder).nonNullable.group({
    ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    razonSocial: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    telefono: ['', Validators.pattern(/^(?:[1-8]\d{7}|9\d{8})?$/)],
    direccion: ['', Validators.maxLength(150)],
  });

  protected listar() { return this.service.todos(); }
  protected buscar(id: number) { return this.service.buscar(id); }
  protected idDe(c: ClienteResponse) { return c.idCliente; }
  protected etiqueta(c: ClienteResponse) { return `#${c.idCliente} · ${c.razonSocial} · RUC ${c.ruc}${c.estado === 'INACTIVO' ? ' (de baja)' : ''}`; }
  protected cargarFormulario(c: ClienteResponse) {
    this.form.reset({ ruc: c.ruc, razonSocial: c.razonSocial, telefono: (c.telefono ?? '').replace(/\D/g, ''), direccion: c.direccion ?? '' });
  }
  protected override limpiarFormulario() { this.form.reset(); }

  invalido(campo: 'ruc' | 'razonSocial' | 'telefono' | 'direccion') { const c = this.form.controls[campo]; return c.touched && c.invalid; }

  guardar() {
    const c = this.registro();
    if (!c || this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set(''); this.mensaje.set('');
    if (this.form.invalid) { this.error.set('Revisa el RUC, la razón social y el teléfono.'); return; }
    if (!this.form.dirty) { this.mensaje.set('No hay cambios por guardar.'); return; }
    const v = this.form.getRawValue();
    this.ejecutar(this.service.actualizar(c.idCliente, { ruc: v.ruc, razonSocial: v.razonSocial.trim(), telefono: v.telefono, direccion: v.direccion.trim() }),
      `Cliente #${c.idCliente} actualizado.`, 'No se pudo actualizar el cliente.');
  }

  async cambiarEstado() {
    const c = this.registro();
    if (!c || this.guardando()) return;
    const baja = c.estado !== 'INACTIVO';
    const ok = await this.alertas.mostrar(baja
      ? { titulo: '¿Dar de baja al cliente?', tipo: 'advertencia', textoAceptar: 'Sí, dar de baja', textoCancelar: 'Cancelar',
          mensaje: `«${c.razonSocial}» no podrá iniciar sesión ni registrar pedidos. Sus pedidos e historial se conservan y puedes reactivarlo cuando quieras.` }
      : { titulo: '¿Reactivar al cliente?', tipo: 'info', textoAceptar: 'Sí, reactivar', textoCancelar: 'Cancelar',
          mensaje: `«${c.razonSocial}» podrá volver a iniciar sesión con su correo ${c.correo}.` });
    if (!ok) return;
    this.ejecutar(baja ? this.service.darDeBaja(c.idCliente) : this.service.reactivar(c.idUsuario),
      baja ? `Cliente «${c.razonSocial}» dado de baja.` : `Cliente «${c.razonSocial}» reactivado.`,
      baja ? 'No se pudo dar de baja al cliente.' : 'No se pudo reactivar al cliente.');
  }

  private ejecutar(peticion: Observable<unknown>, exito: string, falla: string) {
    this.guardando.set(true); this.error.set(''); this.mensaje.set('');
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.guardando.set(false); this.mensaje.set(exito); this.recargar(); },
      error: (e: HttpErrorResponse) => { this.guardando.set(false); this.error.set(this.mensajeError(e, falla)); },
    });
  }
}
