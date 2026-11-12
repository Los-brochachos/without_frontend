import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { PedidoResponse, PedidoRequest, DetallePedidoResponse } from '../../models/PedidoModel';
import { PaginaResponse, paramsPagina } from '../../models/PaginaModel';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly api = inject(ApiService);
  misPedidos() { return this.api.get<PedidoResponse[]>('pedidos/mis-pedidos'); }
  /** Paginación en servidor. `pagina` empieza en 0. */
  paginado(pagina = 0, tamanio = 10, estado?: string) {
    return this.api.get<PaginaResponse<PedidoResponse>>(`pedidos/paginado?${paramsPagina(pagina, tamanio, { estado })}`);
  }
  misPedidosPaginado(pagina = 0, tamanio = 10, estado?: string) {
    return this.api.get<PaginaResponse<PedidoResponse>>(`pedidos/mis-pedidos/paginado?${paramsPagina(pagina, tamanio, { estado })}`);
  }
  /** ADMIN / PROGRAMADOR: cancela cualquier pedido RECIBIDO o EN_PREPARACION (también sus atenciones PROGRAMADAS). */
  cancelar(id: number, observacion: string) { return this.api.patch<PedidoResponse>(`pedidos/${id}/cancelar`, { observacion }); }
  cancelarPropio(id: number, observacion: string) { return this.api.patch<PedidoResponse>(`pedidos/mis-pedidos/${id}/cancelar`, { observacion }); }
  miPedido(id: number) { return this.api.get<PedidoResponse>(`pedidos/mis-pedidos/${id}`); }
  crear(request: PedidoRequest) { return this.api.post<PedidoResponse>('pedidos', request); }
  detallesPropios(id: number) { return this.api.get<DetallePedidoResponse[]>(`pedidos/${id}/detalles`); }
}
