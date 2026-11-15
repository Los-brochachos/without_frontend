import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { AtencionFormularioBase } from './atencion-formulario-base';

/**
 * PROGRAMADOR · Atenciones · Programar atención. POST /atenciones.
 * Ruta: /dashboard/atenciones/nueva (?pedido=ID preselecciona el pedido). La edición tiene su propia pantalla (atenciones/editar).
 */
@Component({ selector: 'app-programar-atencion', imports: [FechaPipe, ReactiveFormsModule, RouterLink, InputTextModule], templateUrl: './formulario-atencion.html' })
export class ProgramarAtencion extends AtencionFormularioBase {
  constructor() {
    super();
    this.cargar();
  }

  cargar() {
    this.cargarDatos(null, () => {
      const pedido = Number(this.route.snapshot.queryParamMap.get('pedido'));
      if (Number.isSafeInteger(pedido) && this.pendientes().some(p => p.idPedido === pedido)) {
        this.form.controls.idPedido.setValue(pedido);
      } else if (this.route.snapshot.queryParamMap.has('pedido')) {
        this.error.set('El pedido seleccionado ya no está disponible para programar. Selecciona otro pedido pendiente.');
      }
    });
  }
}
