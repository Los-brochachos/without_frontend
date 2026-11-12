/** Espejo de PaginaResponse<T> del backend (dto/comun/PaginaResponse.java). */
export interface PaginaResponse<T> {
  contenido: T[];
  /** Página actual, empieza en 0. */
  pagina: number;
  tamanio: number;
  totalElementos: number;
  totalPaginas: number;
  primera: boolean;
  ultima: boolean;
}

/** Arma el query string que esperan los endpoints paginados del backend. */
export function paramsPagina(pagina: number, tamanio: number, filtros: Record<string, string | null | undefined> = {}): string {
  const params = new URLSearchParams({ pagina: String(pagina), tamanio: String(tamanio) });
  Object.entries(filtros).forEach(([clave, valor]) => { if (valor) params.set(clave, valor); });
  return params.toString();
}
