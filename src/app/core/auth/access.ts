import { DASHBOARD_ROLES } from '../../features/dashboard/dashboard-data';

/** Cuenta única con acceso total (ver SuperAdminInicializador en el backend). */
export const SUPERADMIN = 'SUPERADMIN';

/**
 * ¿El rol del usuario puede actuar como alguno de `roles`? SUPERADMIN puede actuar como todos
 * (en el backend, la jerarquía de roles hace lo mismo). Usar esto en vez de comparar `rol === '...'`.
 */
export function tieneRol(rolUsuario: string | undefined, ...roles: string[]): boolean {
  return !!rolUsuario && (rolUsuario === SUPERADMIN || roles.includes(rolUsuario));
}

export function homeForRole(role?: string): string {
  return role === 'CLIENTE' ? '/cliente/inicio' : '/dashboard';
}

export function canAccessArea(role: string, area?: string): boolean {
  if (role === SUPERADMIN) return true; // entra al área del personal y a la del cliente
  if (area === 'cliente') return role === 'CLIENTE';
  if (area === 'staff') return role !== 'CLIENTE' && !!DASHBOARD_ROLES[role];
  return true;
}

export function canAccessSection(role: string, key?: string): boolean {
  if (role === SUPERADMIN) return true;
  return !key || !!DASHBOARD_ROLES[role]?.sections.some(section => section.key === key);
}
