import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { SeguimientoPedidoResponse } from '../../models/PedidoModel';

@Injectable({ providedIn: 'root' })
export class SeguimientoPedidoService {
  private readonly api = inject(ApiService);
  propio(id: number) { return this.api.get<SeguimientoPedidoResponse[]>(`pedidos/${id}/seguimiento`); }
  /** ADMIN / ANALISTA / PROGRAMADOR: historial de cualquier pedido. */
  todos(id: number) { return this.api.get<SeguimientoPedidoResponse[]>(`pedidos/${id}/seguimiento/todos`); }
}
