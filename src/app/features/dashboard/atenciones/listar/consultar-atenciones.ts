import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { AtencionResponse } from '../../../../core/models/AtencionModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { Paginacion } from '../../compartido/listado/paginacion';

/** Consulta de todas las atenciones (ADMIN, ANALISTA y TÉCNICO): solo lectura. GET /atenciones. */
@Component({ selector: 'app-consultar-atenciones', imports: [RouterLink, InputTextModule, FechaPipe, Paginacion], templateUrl: './consultar-atenciones.html' })
export class ConsultarAtenciones extends ListadoBase<AtencionResponse> {
  readonly estados = ['PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA'];
  protected fuente(): FuenteListado { return { path: 'atenciones' }; }
  protected coincide(a: AtencionResponse, texto: string): boolean {
    return [String(a.idAtencion), String(a.idPedido), a.razonSocial, a.nombreConductor, a.cisterna]
      .some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
}
