import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { CisternaService } from '../../../../core/services/cisterna/cisterna-service';
import { CisternaResponse } from '../../../../core/models/CisternaModel';
import { Alertas } from '../../../../core/ui/alerta-modal/alertas';
import { EdicionBase } from '../../compartido/edicion/edicion-base';
import { SelectorEdicion } from '../../compartido/edicion/selector-edicion';
import { VALIDACION_CISTERNA } from '../crear/crear-cisterna';

/**
 * ADMIN · Cisternas · Editar cisterna (y darla de baja).
 * PUT /cisternas y DELETE /cisternas: el backend ubica la cisterna por su nombre ACTUAL, por eso se envía el nombre original.
 */
@Component({ selector: 'app-editar-cisterna', imports: [ReactiveFormsModule, RouterLink, InputTextModule, SelectorEdicion], templateUrl: './editar-cisterna.html' })
export class EditarCisterna extends EdicionBase<CisternaResponse> {
  private readonly service = inject(CisternaService);
  private readonly alertas = inject(Alertas);
  protected readonly rutaBase = '/dashboard/cisternas';
  readonly form = inject(FormBuilder).nonNullable.group({
    placa: ['', VALIDACION_CISTERNA.placa],
    nombre: ['', VALIDACION_CISTERNA.nombre],
    capacidad: [null as number | null, VALIDACION_CISTERNA.capacidad],
  });

  protected listar() { return this.service.todas(); }
  protected buscar(id: number) { return this.service.buscar(id); }
  protected idDe(c: CisternaResponse) { return c.idCisterna; }
  protected etiqueta(c: CisternaResponse) { return `#${c.idCisterna} · ${c.placa} · ${c.nombre}${c.estado === 'INACTIVO' ? ' (inactiva)' : ''}`; }
  protected cargarFormulario(c: CisternaResponse) { this.form.reset({ placa: c.placa, nombre: c.nombre, capacidad: c.capacidad }); this.form.enable(); }
  protected override limpiarFormulario() { this.form.reset(); }

  invalido(campo: 'placa' | 'nombre' | 'capacidad') { const c = this.form.controls[campo]; return c.touched && c.invalid; }

  guardar() {
    const c = this.registro();
    if (!c || this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set(''); this.mensaje.set('');
    if (this.form.invalid) { this.error.set('Revisa los campos marcados.'); return; }
    if (!this.form.dirty) { this.mensaje.set('No hay cambios por guardar.'); return; }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.service.editar(c.nombre, { placa: v.placa.trim().toUpperCase(), nombre: v.nombre.trim(), capacidad: Number(v.capacidad) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: act => { this.guardando.set(false); this.mensaje.set(`Cisterna #${act.idCisterna} actualizada.`); this.recargar(); },
        error: (e: HttpErrorResponse) => { this.guardando.set(false); this.error.set(this.mensajeError(e, 'No se pudo actualizar la cisterna.')); },
      });
  }

  async darDeBaja() {
    const c = this.registro();
    if (!c || c.estado === 'INACTIVO' || this.guardando()) return;
    const ok = await this.alertas.mostrar({
      titulo: '¿Dar de baja la cisterna?', tipo: 'advertencia', textoAceptar: 'Sí, dar de baja', textoCancelar: 'Cancelar',
      mensaje: `«${c.nombre}» (${c.placa}) quedará INACTIVA: no aparecerá para programar nuevas atenciones. Su historial se conserva.`,
    });
    if (!ok) return;
    this.guardando.set(true); this.error.set(''); this.mensaje.set('');
    this.service.darDeBaja(c.nombre).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigate([this.rutaBase], { state: { aviso: `Cisterna «${c.nombre}» dada de baja.` } }),
      error: (e: HttpErrorResponse) => { this.guardando.set(false); this.error.set(this.mensajeError(e, 'No se pudo dar de baja la cisterna.')); },
    });
  }
}
