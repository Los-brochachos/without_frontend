import { Type } from '@angular/core';


export interface ItemMenu { titulo: string; ruta: string; icono: string }

export interface DashboardSection {
  key: string;
  /** Título de la página/listado. */
  title: string;
  /** Endpoint (bajo /api/v1) que usa el listado genérico y el resumen. */
  path: string;
  columns: { key: string; label: string }[];
  /** Si existe, el listado pide las páginas al backend (PaginaResponse) en vez de paginar en memoria. */
  pagedPath?: string;
  /** Valores del filtro `estado` que acepta el endpoint paginado. */
  estados?: string[];
  /** Texto del grupo en el menú lateral. */
  menu: string;
  icono: string;
  /** Opciones del submenú; vacío = enlace directo a la sección. */
  hijos: ItemMenu[];
  /** Pantalla propia; si no hay, se usa el listado genérico. */
  pantalla?: () => Promise<Type<unknown>>;
}

const ESTADOS_PEDIDO = ['RECIBIDO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
const columns = (...pairs: string[][]) => pairs.map(([key, label]) => ({ key, label }));
const listar = (titulo: string, key: string): ItemMenu => ({ titulo, ruta: `/dashboard/${key}`, icono: 'pi pi-list' });

// ---------- Pantallas (carga diferida) ----------
const P = {
  catalogo: () => import('./productos/listar/listar-productos').then(m => m.CatalogoProductos),
  alertas: () => import('./alertas/listar/listar-alertas').then(m => m.AlertasOperacion),
  pedidosProgramador: () => import('./pedidos/listar/listar-pedidos-programador').then(m => m.PedidosProgramador),
  atencionesProgramador: () => import('./atenciones/listar/listar-atenciones').then(m => m.AtencionesProgramador),
  atencionesConductor: () => import('./atenciones/listar/mis-atenciones-conductor').then(m => m.MisAtencionesConductor),
};

// ---------- Módulos base (lo común a todos los roles que los tienen) ----------
const pedidos: DashboardSection = {
  key: 'pedidos', title: 'Pedidos', path: 'pedidos', pagedPath: 'pedidos/paginado', estados: ESTADOS_PEDIDO,
  columns: columns(['idPedido', 'Pedido'], ['razonSocial', 'Empresa'], ['estado', 'Estado'], ['prioridad', 'Prioridad'], ['fechaEntregaEstimada', 'Entrega estimada']),
  menu: 'Pedidos', icono: 'pi pi-shopping-cart', hijos: [listar('Listar pedidos', 'pedidos')],
};
const atenciones: DashboardSection = {
  key: 'atenciones', title: 'Atenciones', path: 'atenciones',
  columns: columns(['idAtencion', 'Atención'], ['estado', 'Estado'], ['fechaInicioProgramada', 'Inicio programado'], ['idPedido', 'Pedido']),
  menu: 'Atenciones', icono: 'pi pi-calendar', hijos: [listar('Listar atenciones', 'atenciones')],
};
const alertas: DashboardSection = {
  key: 'alertas', title: 'Alertas', path: 'alertas',
  columns: columns(['idAlerta', 'Alerta'], ['tipo', 'Tipo'], ['estado', 'Estado'], ['mensaje', 'Mensaje']),
  menu: 'Alertas', icono: 'pi pi-bell', hijos: [listar('Listar alertas', 'alertas')], pantalla: P.alertas,
};
const fallas: DashboardSection = {
  key: 'fallas', title: 'Fallas de cisternas', path: 'fallas',
  columns: columns(['idFalla', 'Falla'], ['idCisterna', 'Cisterna'], ['estado', 'Estado'], ['descripcion', 'Descripción']),
  menu: 'Fallas', icono: 'pi pi-exclamation-triangle', hijos: [listar('Listar fallas', 'fallas')],
};
const productos: DashboardSection = {
  key: 'productos', title: 'Productos disponibles', path: 'productos/activos',
  columns: columns(['nombre', 'Producto'], ['tipoGas', 'Gas'], ['unidadMedida', 'Unidad'], ['precioUnitario', 'Precio unitario']),
  menu: 'Productos', icono: 'pi pi-box', hijos: [listar('Listar productos', 'productos')], pantalla: P.catalogo,
};
const cisternas: DashboardSection = {
  key: 'cisternas', title: 'Cisternas activas', path: 'cisternas/activas',
  columns: columns(['idCisterna', 'Cisterna'], ['placa', 'Placa'], ['estado', 'Estado']),
  menu: 'Cisternas', icono: 'pi pi-truck', hijos: [listar('Listar cisternas', 'cisternas')],
};
const conductores: DashboardSection = {
  key: 'conductores', title: 'Conductores activos', path: 'conductores/activos',
  columns: columns(['idTrabajador', 'Conductor'], ['nombres', 'Nombres'], ['estado', 'Estado']),
  menu: 'Conductores', icono: 'pi pi-car', hijos: [listar('Listar conductores', 'conductores')],
};
const historial: DashboardSection = {
  key: 'historial', title: 'Historial de mantenimiento', path: 'historial',
  columns: columns(['idHistorial', 'Registro'], ['idCisterna', 'Cisterna'], ['descripcion', 'Descripción']),
  menu: 'Mantenimiento', icono: 'pi pi-history', hijos: [listar('Listar historial', 'historial')],
};
const usuarios: DashboardSection = {
  key: 'usuarios', title: 'Usuarios', path: 'usuarios',
  columns: columns(['idUsuario', 'Usuario'], ['correo', 'Correo'], ['rol', 'Rol'], ['estado', 'Estado']),
  menu: 'Usuarios', icono: 'pi pi-id-card', hijos: [listar('Listar usuarios', 'usuarios')],
};
const clientes: DashboardSection = {
  key: 'clientes', title: 'Clientes', path: 'clientes',
  columns: columns(['idCliente', 'Cliente'], ['razonSocial', 'Razón social'], ['ruc', 'RUC']),
  menu: 'Clientes', icono: 'pi pi-building', hijos: [listar('Listar clientes', 'clientes')],
};
const trabajadores: DashboardSection = {
  key: 'trabajadores', title: 'Trabajadores', path: 'trabajadores',
  columns: columns(['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['rol', 'Rol'], ['estado', 'Estado']),
  menu: 'Trabajadores', icono: 'pi pi-users',
  hijos: [{ titulo: 'Crear Trabajador', ruta: '/dashboard/trabajadores/nuevo', icono: 'pi pi-user-plus' }, listar('Listar Trabajadores', 'trabajadores')],
};

// ---------- Variantes por rol (solo lo que cambia respecto al módulo base) ----------
/** ADMIN gestiona el catálogo; CLIENTE, PROGRAMADOR y ANALISTA solo lo listan. Misma pantalla para todos. */
const productosAdmin: DashboardSection = {
  ...productos, title: 'Productos',
  hijos: [{ titulo: 'Crear producto', ruta: '/dashboard/productos/nuevo', icono: 'pi pi-plus' }, listar('Listar productos', 'productos')],
};
const pedidosProgramador: DashboardSection = { ...pedidos, pantalla: P.pedidosProgramador };
const atencionesProgramador: DashboardSection = {
  ...atenciones, pantalla: P.atencionesProgramador,
  hijos: [listar('Listar atenciones', 'atenciones'), { titulo: 'Crear atención', ruta: '/dashboard/atenciones/nueva', icono: 'pi pi-calendar-plus' }],
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

// ---------- Cliente (rutas bajo /cliente) ----------
const pedidosCliente: DashboardSection = {
  ...pedidos, title: 'Mis pedidos', path: 'pedidos/mis-pedidos', pagedPath: 'pedidos/mis-pedidos/paginado',
  columns: pedidos.columns.filter(column => column.key !== 'razonSocial'),
  hijos: [
    { titulo: 'Mis pedidos', ruta: '/cliente/pedidos', icono: 'pi pi-list' },
    { titulo: 'Crear pedido', ruta: '/cliente/pedidos/nuevo', icono: 'pi pi-plus' },
    { titulo: 'Editar pedido', ruta: '/cliente/pedidos/editar', icono: 'pi pi-pencil' },
  ],
};
const citasCliente: DashboardSection = { key: 'citas', title: 'Citas', path: 'atenciones/mis-atenciones', columns: [], menu: 'Citas', icono: 'pi pi-calendar-clock', hijos: [] };
const seguimientoCliente: DashboardSection = { key: 'seguimiento', title: 'Seguimiento', path: 'pedidos/mis-pedidos', columns: [], menu: 'Seguimiento', icono: 'pi pi-map-marker', hijos: [] };
const productosCliente: DashboardSection = { ...productos, hijos: [] };

export const DASHBOARD_ROLES: Record<string, { title: string; description: string; sections: DashboardSection[] }> = {
  ADMIN: { title: 'Administración', description: 'Resumen general de usuarios, clientes y operaciones.', sections: [trabajadores, pedidos, usuarios, clientes, atenciones, alertas, fallas, productosAdmin, cisternas, conductores, historial] },
  ANALISTA: { title: 'Análisis de operaciones', description: 'Consulta el estado de los pedidos y los recursos del sistema.', sections: [pedidos, clientes, atenciones, alertas, fallas, productos, cisternas, conductores, usuarios, historial] },
  PROGRAMADOR: { title: 'Programación de operaciones', description: 'Consulta pedidos, atenciones, alertas y recursos disponibles para planificar el servicio.', sections: [pedidosProgramador, atencionesProgramador, alertas, conductores, cisternas, productos] },
  CONDUCTOR: { title: 'Operaciones de transporte', description: 'Consulta las atenciones y alertas de operación disponibles para tu rol.', sections: [atencionesConductor, alertasConductor] },
  TECNICO: { title: 'Mantenimiento', description: 'Consulta fallas, historial de mantenimiento, cisternas y atenciones.', sections: [fallas, historial, cisternas, atenciones] },
  CLIENTE: { title: 'Mis pedidos', description: 'Consulta tus pedidos y los productos disponibles.', sections: [pedidosCliente, citasCliente, seguimientoCliente, productosCliente] },
};

/** Sección de un rol (o null si el rol no la tiene → bloqueada). */
export function seccionDe(rol: string | undefined, key: string): DashboardSection | null {
  return DASHBOARD_ROLES[rol ?? '']?.sections.find(s => s.key === key) ?? null;
}

/** Ruta base de una sección según el área del rol. */
export function rutaSeccion(rol: string | undefined, key: string): string {
  return rol === 'CLIENTE' ? `/cliente/${key}` : `/dashboard/${key}`;
}
