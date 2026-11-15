import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { PedidoResponse } from '../../../../core/models/PedidoModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { Paginacion } from '../../compartido/listado/paginacion';

export const ESTADOS_PEDIDO = ['RECIBIDO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];

/** Pedidos de todos los clientes (ADMIN y ANALISTA). Paginado en el servidor: GET /pedidos/paginado. */
@Component({ selector: 'app-listar-pedidos', imports: [RouterLink, InputTextModule, FechaPipe, Paginacion], templateUrl: './listar-pedidos.html' })
export class ListarPedidos extends ListadoBase<PedidoResponse> {
  readonly estados = ESTADOS_PEDIDO;
  protected fuente(): FuenteListado { return { path: 'pedidos/paginado', paginado: true }; }
  protected coincide(p: PedidoResponse, texto: string): boolean {
    return [String(p.idPedido), p.razonSocial, p.prioridad, p.estado].some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
  clasePrioridad(prioridad: string): string {
    return prioridad === 'ALTA' ? 'bg-red-50 text-red-700' : prioridad === 'MEDIA' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  }
}
