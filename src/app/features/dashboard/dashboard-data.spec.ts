import { describe, expect, it } from 'vitest';
import { canAccessSection } from '../../core/auth/access';
import { DASHBOARD_ROLES, seccionDe } from './dashboard-data';

/** La configuración es la única fuente de verdad: menú, guard y pantallas salen de aquí. */
describe('Configuración de módulos por rol', () => {
  it('un módulo compartido usa la misma pantalla en todos los roles que lo tienen', async () => {
    const roles = Object.entries(DASHBOARD_ROLES).filter(([, c]) => c.sections.some(s => s.key === 'productos')).map(([rol]) => rol);
    expect(roles.sort()).toEqual(['ADMIN', 'ANALISTA', 'CLIENTE', 'PROGRAMADOR']);
    const pantallas = await Promise.all(['ADMIN', 'ANALISTA', 'PROGRAMADOR'].map(rol => seccionDe(rol, 'productos')!.pantalla!()));
    expect(new Set(pantallas.map(p => p.name)).size).toBe(1);
    expect((await seccionDe('CONDUCTOR', 'alertas')!.pantalla!()).name).toBe((await seccionDe('PROGRAMADOR', 'alertas')!.pantalla!()).name);
  });

  it('Productos: ADMIN crea y lista; CLIENTE, PROGRAMADOR y ANALISTA solo listan', () => {
    expect(seccionDe('ADMIN', 'productos')!.hijos.map(h => h.titulo)).toEqual(['Crear producto', 'Listar productos']);
    expect(seccionDe('PROGRAMADOR', 'productos')!.hijos.map(h => h.titulo)).toEqual(['Listar productos']);
    expect(seccionDe('ANALISTA', 'productos')!.hijos.map(h => h.titulo)).toEqual(['Listar productos']);
    expect(seccionDe('CLIENTE', 'productos')!.hijos).toEqual([]);   // enlace directo en su menú
  });

  it('cada rol tiene su variante solo donde hace falta', async () => {
    expect((await seccionDe('PROGRAMADOR', 'pedidos')!.pantalla!()).name).toContain('PedidosProgramador');
    expect((await seccionDe('ADMIN', 'pedidos')!.pantalla!()).name).toContain('ListarPedidos');
    expect((await seccionDe('CLIENTE', 'pedidos')!.pantalla!()).name).toContain('MisPedidos');
    expect(seccionDe('CONDUCTOR', 'atenciones')!.path).toBe('atenciones/asignadas');
  });

  it('cada módulo del personal abre su propia pantalla (ya no hay listado genérico)', async () => {
    const esperadas: Record<string, string> = { fallas: 'ListarFallas', cisternas: 'ListarCisternas', conductores: 'ListarConductores',
      historial: 'ListarMantenimiento', usuarios: 'ListarUsuarios', clientes: 'ListarClientes', atenciones: 'ConsultarAtenciones' };
    for (const [key, nombre] of Object.entries(esperadas)) expect((await seccionDe('ADMIN', key)!.pantalla!()).name).toContain(nombre);
    Object.entries(DASHBOARD_ROLES).filter(([rol]) => rol !== 'CLIENTE').forEach(([rol, c]) =>
      c.sections.forEach(s => expect(s.pantalla, `${rol}/${s.key}`).toBeTypeOf('function')));
  });

  it('si el rol no tiene el módulo, no existe para él y el guard lo bloquea', () => {
    expect(seccionDe('CONDUCTOR', 'productos')).toBeNull();
    expect(canAccessSection('CONDUCTOR', 'productos')).toBe(false);
    expect(canAccessSection('TECNICO', 'pedidos')).toBe(false);
    expect(canAccessSection('CLIENTE', 'usuarios')).toBe(false);
    expect(canAccessSection('PROGRAMADOR', 'alertas')).toBe(true);
    expect(canAccessSection('CLIENTE', 'citas')).toBe(true);
  });

  it('todo módulo del personal tiene icono y al menos una opción en el menú', () => {
    Object.entries(DASHBOARD_ROLES).filter(([rol]) => rol !== 'CLIENTE').forEach(([, c]) =>
      c.sections.forEach(s => { expect(s.icono).toMatch(/^pi pi-/); expect(s.hijos.length).toBeGreaterThan(0); }));
  });
});
