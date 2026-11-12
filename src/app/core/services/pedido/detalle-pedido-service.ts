import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { DetallePedidoResponse } from '../../models/PedidoModel';

/**
 * Edición de productos de un pedido propio (rol CLIENTE).
 * El backend solo lo permite mientras el pedido está en estado RECIBIDO.
 */
@Injectable({ providedIn: 'root' })
export class DetallePedidoService {
  private readonly api = inject(ApiService);

  /** POST /pedidos/{id}/detalles — agrega un producto que aún no está en el pedido. */
  agregar(idPedido: number, idProducto: number, cantidad: number) {
    return this.api.post<DetallePedidoResponse>(`pedidos/${idPedido}/detalles`, { idProducto, cantidad });
  }

  /** PATCH /pedidos/{id}/detalles/{idDetalle}/cantidad — suma `cantidad` a la existente. */
  aumentarCantidad(idPedido: number, idDetalle: number, cantidad: number) {
    return this.api.patch<DetallePedidoResponse>(`pedidos/${idPedido}/detalles/${idDetalle}/cantidad`, { cantidad });
  }

  /** PATCH /pedidos/{id}/detalles/{idDetalle}/cancelar — quita el producto (baja lógica). */
  quitar(idPedido: number, idDetalle: number) {
    return this.api.patch<DetallePedidoResponse>(`pedidos/${idPedido}/detalles/${idDetalle}/cancelar`, {});
  }
}
