import { Type } from '@angular/core';


export interface ItemMenu { titulo: string; ruta: string; icono: string }

export interface DashboardSection {
  key: string;
  /** Título de la página/listado. */
  title: string;
  /** Endpoint (bajo /api/v1) que usa el resumen de inicio para contar registros. */
  path: string;
  /** Texto del grupo en el menú lateral. */
  menu: string;
  icono: string;
  /** Opciones del submenú; vacío = enlace directo a la sección. */
  hijos: ItemMenu[];
  /** Pantalla (componente) que abre el módulo para el rol. */
  pantalla?: () => Promise<Type<unknown>>;
}

const listar = (titulo: string, key: string): ItemMenu => ({ titulo, ruta: `/dashboard/${key}`, icono: 'pi pi-list' });

// ---------- Pantallas (carga diferida) ----------
const P = {
  catalogo: () => import('./productos/listar/listar-productos').then(m => m.CatalogoProductos),
  alertas: () => import('./alertas/listar/listar-alertas').then(m => m.AlertasOperacion),
  pedidosProgramador: () => import('./pedidos/listar/listar-pedidos-programador').then(m => m.PedidosProgramador),
  atencionesProgramador: () => import('./atenciones/listar/listar-atenciones').then(m => m.AtencionesProgramador),
  atencionesConductor: () => import('./atenciones/listar/mis-atenciones-conductor').then(m => m.MisAtencionesConductor),
  pedidos: () => import('./pedidos/listar/listar-pedidos').then(m => m.ListarPedidos),
  misPedidos: () => import('./pedidos/listar/mis-pedidos').then(m => m.MisPedidos),
  atenciones: () => import('./atenciones/listar/consultar-atenciones').then(m => m.ConsultarAtenciones),
  fallas: () => import('./fallas/listar/listar-fallas').then(m => m.ListarFallas),
  cisternas: () => import('./cisternas/listar/listar-cisternas').then(m => m.ListarCisternas),
  conductores: () => import('./conductores/listar/listar-conductores').then(m => m.ListarConductores),
  mantenimiento: () => import('./mantenimiento/listar/listar-mantenimiento').then(m => m.ListarMantenimiento),
  usuarios: () => import('./usuarios/listar/listar-usuarios').then(m => m.ListarUsuarios),
  clientes: () => import('./clientes/listar/listar-clientes').then(m => m.ListarClientes),
  trabajadores: () => import('./trabajadores/listar/listar-trabajadores').then(m => m.ListadoTrabajadores),
};

// ---------- Módulos base (lo común a todos los roles que los tienen) ----------
const pedidos: DashboardSection = {
  key: 'pedidos', title: 'Pedidos', path: 'pedidos', pantalla: P.pedidos,
  menu: 'Pedidos', icono: 'pi pi-shopping-cart', hijos: [listar('Listar pedidos', 'pedidos')],
};
const atenciones: DashboardSection = {
  key: 'atenciones', title: 'Atenciones', path: 'atenciones', pantalla: P.atenciones,
  menu: 'Atenciones', icono: 'pi pi-calendar', hijos: [listar('Listar atenciones', 'atenciones')],
};
const alertas: DashboardSection = {
  key: 'alertas', title: 'Alertas', path: 'alertas',
  menu: 'Alertas', icono: 'pi pi-bell', hijos: [listar('Listar alertas', 'alertas')], pantalla: P.alertas,
};
const fallas: DashboardSection = {
  key: 'fallas', title: 'Fallas de cisternas', path: 'fallas', pantalla: P.fallas,
  menu: 'Fallas', icono: 'pi pi-exclamation-triangle', hijos: [listar('Listar fallas', 'fallas')],
};
const productos: DashboardSection = {
  key: 'productos', title: 'Productos disponibles', path: 'productos/activos',
  menu: 'Productos', icono: 'pi pi-box', hijos: [listar('Listar productos', 'productos')], pantalla: P.catalogo,
};
const cisternas: DashboardSection = {
  key: 'cisternas', title: 'Cisternas activas', path: 'cisternas/activas', pantalla: P.cisternas,
  menu: 'Cisternas', icono: 'pi pi-truck', hijos: [listar('Listar cisternas', 'cisternas')],
};
const conductores: DashboardSection = {
  key: 'conductores', title: 'Conductores activos', path: 'conductores/activos', pantalla: P.conductores,
  menu: 'Conductores', icono: 'pi pi-car', hijos: [listar('Listar conductores', 'conductores')],
};
const historial: DashboardSection = {
  key: 'historial', title: 'Historial de mantenimiento', path: 'historial', pantalla: P.mantenimiento,
  menu: 'Mantenimiento', icono: 'pi pi-history', hijos: [listar('Listar historial', 'historial')],
};
const usuarios: DashboardSection = {
  key: 'usuarios', title: 'Usuarios', path: 'usuarios', pantalla: P.usuarios,
  menu: 'Usuarios', icono: 'pi pi-id-card', hijos: [listar('Listar usuarios', 'usuarios')],
};
const clientes: DashboardSection = {
  key: 'clientes', title: 'Clientes', path: 'clientes', pantalla: P.clientes,
  menu: 'Clientes', icono: 'pi pi-building', hijos: [listar('Listar clientes', 'clientes')],
};
const trabajadores: DashboardSection = {
  key: 'trabajadores', title: 'Trabajadores', path: 'trabajadores', pantalla: P.trabajadores,
  menu: 'Trabajadores', icono: 'pi pi-users',
  hijos: [{ titulo: 'Crear Trabajador', ruta: '/dashboard/trabajadores/nuevo', icono: 'pi pi-user-plus' }, listar('Listar Trabajadores', 'trabajadores'), { titulo: 'Editar Trabajador', ruta: '/dashboard/trabajadores/editar', icono: 'pi pi-user-edit' }],
};

// ---------- Variantes por rol (solo lo que cambia respecto al módulo base) ----------
/** ADMIN gestiona el catálogo; CLIENTE, PROGRAMADOR y ANALISTA solo lo listan. Misma pantalla para todos. */
const productosAdmin: DashboardSection = {
  ...productos, title: 'Productos',
  hijos: [{ titulo: 'Crear producto', ruta: '/dashboard/productos/nuevo', icono: 'pi pi-plus' }, listar('Listar productos', 'productos'), { titulo: 'Editar producto', ruta: '/dashboard/productos/editar', icono: 'pi pi-pencil' }],
};
const pedidosProgramador: DashboardSection = { ...pedidos, pantalla: P.pedidosProgramador };
const atencionesProgramador: DashboardSection = {
  ...atenciones, pantalla: P.atencionesProgramador,
  hijos: [listar('Listar atenciones', 'atenciones'), { titulo: 'Crear atención', ruta: '/dashboard/atenciones/nueva', icono: 'pi pi-calendar-plus' }, { titulo: 'Editar atención', ruta: '/dashboard/atenciones/editar', icono: 'pi pi-pencil' }],
};
/** El conductor solo ve las alertas de sus atenciones (el backend ya no le permite GET /alertas). */
const alertasConductor: DashboardSection = {
  ...alertas, title: 'Mis alertas', path: 'alertas/mis-alertas',
  hijos: [{ titulo: 'Mis alertas', ruta: '/dashboard/alertas', icono: 'pi pi-list' }],
};
const atencionesConductor: DashboardSection = {
  ...atenciones, path: 'atenciones/asignadas', pantalla: P.atencionesConductor,
  hijos: [{ titulo: 'Mis atenciones', ruta: '/dashboard/atenciones', icono: 'pi pi-list' }],
};

/** El técnico, además de listar, reporta fallas y registra mantenimientos (endpoints exclusivos de TECNICO). */
const fallasTecnico: DashboardSection = {
  ...fallas,
  hijos: [listar('Listar fallas', 'fallas'), { titulo: 'Reportar falla', ruta: '/dashboard/fallas/nueva', icono: 'pi pi-plus' }],
};
const historialTecnico: DashboardSection = {
  ...historial,
  hijos: [listar('Listar historial', 'historial'), { titulo: 'Registrar mantenimiento', ruta: '/dashboard/historial/nuevo', icono: 'pi pi-plus' }],
};

/** El ADMIN gestiona la flota: crea, lista y edita (o da de baja) cisternas. */
const cisternasAdmin: DashboardSection = {
  ...cisternas,
  hijos: [{ titulo: 'Crear cisterna', ruta: '/dashboard/cisternas/nueva', icono: 'pi pi-plus' }, listar('Listar cisternas', 'cisternas'), { titulo: 'Editar cisterna', ruta: '/dashboard/cisternas/editar', icono: 'pi pi-pencil' }],
};

/** El ADMIN además edita clientes y los da de baja / reactiva. */
const clientesAdmin: DashboardSection = {
  ...clientes,
  hijos: [listar('Listar clientes', 'clientes'), { titulo: 'Editar cliente', ruta: '/dashboard/clientes/editar', icono: 'pi pi-pencil' }],
};

// ---------- Cliente (rutas bajo /cliente) ----------
const pedidosCliente: DashboardSection = {
  ...pedidos, title: 'Mis pedidos', path: 'pedidos/mis-pedidos', pantalla: P.misPedidos,
  hijos: [
    { titulo: 'Mis pedidos', ruta: '/cliente/pedidos', icono: 'pi pi-list' },
    { titulo: 'Crear pedido', ruta: '/cliente/pedidos/nuevo', icono: 'pi pi-plus' },
    { titulo: 'Editar pedido', ruta: '/cliente/pedidos/editar', icono: 'pi pi-pencil' },
  ],
};
const citasCliente: DashboardSection = { key: 'citas', title: 'Citas', path: 'atenciones/mis-atenciones', menu: 'Citas', icono: 'pi pi-calendar-clock', hijos: [] };
const seguimientoCliente: DashboardSection = { key: 'seguimiento', title: 'Seguimiento', path: 'pedidos/mis-pedidos', menu: 'Seguimiento', icono: 'pi pi-map-marker', hijos: [] };
const productosCliente: DashboardSection = { ...productos, hijos: [] };

/**
 * SUPERADMIN · acceso al área del cliente (rutas /cliente/*) con su perfil de cliente propio («Superadministración WITHOUT»).
 * La ruta /dashboard/areaCliente muestra Mis pedidos; los hijos llevan a cada pantalla del cliente.
 */
const areaClienteSuperadmin: DashboardSection = {
  key: 'areaCliente', title: 'Área del cliente', path: 'pedidos/mis-pedidos', pantalla: P.misPedidos,
  menu: 'Área del cliente', icono: 'pi pi-building',
  hijos: [
    { titulo: 'Inicio del cliente', ruta: '/cliente/inicio', icono: 'pi pi-home' },
    { titulo: 'Mis pedidos', ruta: '/cliente/pedidos', icono: 'pi pi-list' },
    { titulo: 'Crear pedido', ruta: '/cliente/pedidos/nuevo', icono: 'pi pi-plus' },
    { titulo: 'Editar pedido', ruta: '/cliente/pedidos/editar', icono: 'pi pi-pencil' },
    { titulo: 'Citas', ruta: '/cliente/citas', icono: 'pi pi-calendar-clock' },
    { titulo: 'Seguimiento', ruta: '/cliente/seguimiento', icono: 'pi pi-map-marker' },
    { titulo: 'Perfil de la empresa', ruta: '/cliente/perfil', icono: 'pi pi-id-card' },
    { titulo: 'Centro de ayuda', ruta: '/cliente/ayuda', icono: 'pi pi-question-circle' },
  ],
};

export const DASHBOARD_ROLES: Record<string, { title: string; description: string; sections: DashboardSection[] }> = {
  ADMIN: { title: 'Administración', description: 'Resumen general de usuarios, clientes y operaciones.', sections: [trabajadores, pedidos, usuarios, clientesAdmin, atenciones, alertas, fallas, productosAdmin, cisternasAdmin, conductores, historial] },
  ANALISTA: { title: 'Análisis de operaciones', description: 'Consulta el estado de los pedidos y los recursos del sistema.', sections: [pedidos, clientes, atenciones, alertas, fallas, productos, cisternas, conductores, usuarios, historial] },
  PROGRAMADOR: { title: 'Programación de operaciones', description: 'Consulta pedidos, atenciones, alertas y recursos disponibles para planificar el servicio.', sections: [pedidosProgramador, atencionesProgramador, alertas, conductores, cisternas, productos] },
  CONDUCTOR: { title: 'Operaciones de transporte', description: 'Consulta las atenciones y alertas de operación disponibles para tu rol.', sections: [atencionesConductor, alertasConductor] },
  TECNICO: { title: 'Mantenimiento', description: 'Consulta fallas, historial de mantenimiento, cisternas y atenciones.', sections: [fallasTecnico, historialTecnico, cisternas, atenciones] },
  CLIENTE: { title: 'Mis pedidos', description: 'Consulta tus pedidos y los productos disponibles.', sections: [pedidosCliente, citasCliente, seguimientoCliente, productosCliente] },
  /**
   * Cuenta única con acceso total: todos los módulos del personal en su variante con más acciones
   * (gestión del ADMIN, atenciones del PROGRAMADOR, fallas y mantenimiento del TÉCNICO) y el área del cliente.
   * Para las acciones que exigen un perfil, la cuenta tiene sus propios perfiles ocultos (PerfilSuperadmin en el backend).
   */
  SUPERADMIN: { title: 'Superadministración', description: 'Acceso total a todos los módulos del sistema.', sections: [trabajadores, usuarios, clientesAdmin, pedidos, atencionesProgramador, alertas, fallasTecnico, historialTecnico, productosAdmin, cisternasAdmin, conductores, areaClienteSuperadmin] },
};

/** Sección de un rol (o null si el rol no la tiene → bloqueada). */
export function seccionDe(rol: string | undefined, key: string): DashboardSection | null {
  return DASHBOARD_ROLES[rol ?? '']?.sections.find(s => s.key === key) ?? null;
}

/** Ruta base de una sección según el área del rol. */
export function rutaSeccion(rol: string | undefined, key: string): string {
  return rol === 'CLIENTE' ? `/cliente/${key}` : `/dashboard/${key}`;
}
