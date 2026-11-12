import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { AlertaRequest, AlertaResponse } from '../../models/AlertaModel';

@Injectable({ providedIn: 'root' })
export class AlertaService {
  private readonly api = inject(ApiService);

  /** ADMIN / ANALISTA / PROGRAMADOR: todas las alertas. */
  listar() { return this.api.get<AlertaResponse[]>('alertas'); }

  /** CONDUCTOR: solo las alertas de sus atenciones. */
  misAlertas() { return this.api.get<AlertaResponse[]>('alertas/mis-alertas'); }

  /** Alertas de una atención (el conductor solo puede consultar las suyas; si no, 404). */
  porAtencion(idAtencion: number) { return this.api.get<AlertaResponse[]>(`alertas/atencion/${idAtencion}`); }

  /** CONDUCTOR: reporta una incidencia en una atención EN_CURSO asignada a él. */
  reportar(request: AlertaRequest) { return this.api.post<AlertaResponse>('alertas', request); }

  /** PROGRAMADOR: PENDIENTE → REVISADA. */
  marcarRevisada(id: number) { return this.api.patch<AlertaResponse>(`alertas/${id}/revisar`, {}); }

  /** PROGRAMADOR: REVISADA → ATENDIDA. */
  marcarAtendida(id: number) { return this.api.patch<AlertaResponse>(`alertas/${id}/atender`, {}); }
}
