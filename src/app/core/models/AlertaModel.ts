/** Ciclo de vida de una alerta (backend: EstadoAlerta). PENDIENTE → REVISADA → ATENDIDA. */
export type EstadoAlerta = 'PENDIENTE' | 'REVISADA' | 'ATENDIDA';

export type TipoAlerta = 'FALLA_TECNICA' | 'PRODUCTO_INCORRECTO' | 'CANTIDAD_INCORRECTA' | 'RETRASO' | 'INCIDENTE' | 'OTRO';

export interface AlertaResponse {
  idAlerta: number;
  tipo: TipoAlerta;
  mensaje: string;
  fechaHora: string;
  estado: EstadoAlerta;
  idAtencion: number;
}

/** Etiquetas en español de cada tipo (compartidas por programador y conductor). */
export const TIPOS_ALERTA: Record<TipoAlerta, string> = {
  FALLA_TECNICA: 'Falla técnica', PRODUCTO_INCORRECTO: 'Producto incorrecto', CANTIDAD_INCORRECTA: 'Cantidad incorrecta',
  RETRASO: 'Retraso', INCIDENTE: 'Incidente', OTRO: 'Otro',
};

export interface AlertaRequest { tipo: TipoAlerta; mensaje: string; idAtencion: number; }
