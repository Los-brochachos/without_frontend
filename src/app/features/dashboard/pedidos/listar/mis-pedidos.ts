import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { PedidoResponse } from '../../../../core/models/PedidoModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { Paginacion } from '../../compartido/listado/paginacion';
import { ESTADOS_PEDIDO } from './listar-pedidos';

/**
 * Pedidos del cliente autenticado. Paginado en el servidor: GET /pedidos/mis-pedidos/paginado.
 * Regla del backend: solo un pedido RECIBIDO admite cambios en sus productos.
 */
@Component({ selector: 'app-mis-pedidos', imports: [RouterLink, InputTextModule, FechaPipe, Paginacion], templateUrl: './mis-pedidos.html' })
export class MisPedidos extends ListadoBase<PedidoResponse> {
  readonly estados = ESTADOS_PEDIDO;
  protected fuente(): FuenteListado { return { path: 'pedidos/mis-pedidos/paginado', paginado: true }; }
  protected coincide(p: PedidoResponse, texto: string): boolean {
    return [String(p.idPedido), p.prioridad, p.estado].some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
}
