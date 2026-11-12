import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ProductoCreateRequest, ProductoResponse } from '../../models/ProductoModel';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly api = inject(ApiService);

  /** Catálogo disponible (CLIENTE, PROGRAMADOR, ANALISTA, ADMIN). */
  activos() { return this.api.get<ProductoResponse[]>('productos/activos'); }

  // ----- Gestión (solo ADMIN; el backend lo exige) -----
  /** Incluye inactivos. */
  todos() { return this.api.get<ProductoResponse[]>('productos'); }
  buscar(id: number) { return this.api.get<ProductoResponse>(`productos/${id}`); }
  crear(request: ProductoCreateRequest) { return this.api.post<ProductoResponse>('productos', request); }
  actualizar(id: number, request: Partial<ProductoCreateRequest>) { return this.api.put<ProductoResponse>(`productos/${id}`, request); }
  /** Baja lógica: el producto pasa a INACTIVO y deja de aparecer en el catálogo. */
  desactivar(id: number) { return this.api.delete<void>(`productos/${id}`); }
}
