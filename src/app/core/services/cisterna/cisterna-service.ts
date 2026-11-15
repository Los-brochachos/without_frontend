import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { CisternaResponse } from '../../models/CisternaModel';

export interface CisternaRequest { placa: string; nombre: string; capacidad: number }

/**
 * Cisternas. Lectura: ADMIN, ANALISTA (todas) y PROGRAMADOR/TÉCNICO (activas). Escritura: solo ADMIN.
 * Ojo: el backend edita y da de baja buscando la cisterna por su NOMBRE actual (no por id en la URL).
 */
@Injectable({ providedIn: 'root' })
export class CisternaService {
  private readonly api = inject(ApiService);
  activas() { return this.api.get<CisternaResponse[]>('cisternas/activas'); }
  todas() { return this.api.get<CisternaResponse[]>('cisternas'); }
  buscar(id: number) { return this.api.get<CisternaResponse>(`cisternas/${id}`); }
  crear(datos: CisternaRequest) { return this.api.post<CisternaResponse>('cisternas', datos); }
  /** PUT /cisternas con { nombreBuscar, placa, nombre, capacidad }. */
  editar(nombreActual: string, datos: CisternaRequest) { return this.api.put<CisternaResponse>('cisternas', { nombreBuscar: nombreActual, ...datos }); }
  /** Baja lógica (queda INACTIVA). DELETE /cisternas con { nombre }. */
  darDeBaja(nombre: string) { return this.api.delete<CisternaResponse>('cisternas', { nombre }); }
}
