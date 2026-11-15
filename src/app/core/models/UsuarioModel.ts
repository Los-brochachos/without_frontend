/** GET /usuarios (dto/usuario/UsuarioResponse.java). */
export interface UsuarioResponse {
  idUsuario: number;
  correo: string;
  estado: 'ACTIVO' | 'INACTIVO';
  rol: 'ADMIN' | 'ANALISTA' | 'PROGRAMADOR' | 'CONDUCTOR' | 'TECNICO' | 'CLIENTE' | 'SUPERADMIN';
}
