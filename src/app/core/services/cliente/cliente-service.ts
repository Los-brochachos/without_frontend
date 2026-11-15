import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from '../api.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ClienteResponse, ClienteCreateRequest, ClienteUpdateRequest } from '../../models/ClienteModel';

@Injectable({ providedIn: 'root' })
export class ClienteService {
  readonly revision = signal(0);
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  /** ADMIN / ANALISTA: todos los clientes (incluye los dados de baja). */
  todos() { return this.api.get<ClienteResponse[]>('clientes'); }
  buscar(id: number) { return this.api.get<ClienteResponse>(`clientes/${id}`); }
  /** ADMIN: datos de la empresa. El correo de acceso no se cambia aquí (lo rechaza el backend). */
  actualizar(id: number, request: ClienteUpdateRequest) { return this.api.put<ClienteResponse>(`clientes/${id}`, request); }
  /** ADMIN: baja lógica (la cuenta queda INACTIVA). */
  darDeBaja(id: number) { return this.api.delete<void>(`clientes/${id}`); }
  /** ADMIN: reactiva la cuenta del cliente (PATCH /usuarios/{idUsuario}/activar). */
  reactivar(idUsuario: number) { return this.api.patch<void>(`usuarios/${idUsuario}/activar`, {}); }
  me() { return this.api.get<ClienteResponse>('clientes/me'); }
  actualizarMe(request: ClienteUpdateRequest) { return this.api.patch<ClienteResponse>('clientes/me', request).pipe(tap(() => this.revision.update(v => v + 1))); }
  registrar(request: ClienteCreateRequest) {
    return this.http.post<{ cliente: ClienteResponse; status: string; message: string }>(
      `${environment.apiUrl}/api/v1/clientes/register`, request);
  }
}
