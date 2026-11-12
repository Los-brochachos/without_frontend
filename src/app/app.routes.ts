import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { DASHBOARD_ROLES } from './features/dashboard/dashboard-data';

// Módulos del personal (todos los roles salvo CLIENTE). Qué rol ve cuál lo decide dashboard-data.ts.
const sections = [...new Set(Object.entries(DASHBOARD_ROLES).filter(([rol]) => rol !== 'CLIENTE').flatMap(([, config]) => config.sections.map(section => section.key)))];
const vistaRol = () => import('./features/dashboard/vista-rol/vista-rol').then(m => m.VistaRol);
const listado = () => import('./features/dashboard/compartido/listado/listado').then(m => m.Listado);
// Pantalla de cuenta compartida (seguridad / preferencias / ayuda) para cliente y personal.
const opcionesCuenta = () => import('./features/dashboard/cuenta/opciones').then(m => m.OpcionesCuenta);
const catalogo = () => import('./features/dashboard/productos/listar/listar-productos').then(m => m.CatalogoProductos);

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'cliente', title: 'without · Clientes', data: { area: 'cliente' },
    canActivate: [authGuard], canActivateChild: [authGuard],
    loadComponent: () => import('./layouts/client-layout/client-layout').then(m => m.ClientLayout),
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', loadComponent: () => import('./features/dashboard/inicio/inicio-cliente').then(m => m.Inicio) },
      { path: 'citas', data: { sectionKey: 'citas' }, loadComponent: () => import('./features/dashboard/atenciones/citas/citas').then(m => m.Citas) },
      { path: 'pedidos/nuevo', data: { sectionKey: 'pedidos' }, loadComponent: () => import('./features/dashboard/pedidos/crear/crear-pedido').then(m => m.NuevoPedido) },
      { path: 'pedidos/editar', data: { sectionKey: 'pedidos' }, loadComponent: () => import('./features/dashboard/pedidos/editar/editar-pedido').then(m => m.EditarPedido) },
      { path: 'pedidos/:id/editar', data: { sectionKey: 'pedidos' }, loadComponent: () => import('./features/dashboard/pedidos/editar/editar-pedido').then(m => m.EditarPedido) },
      { path: 'pedidos/:id', data: { sectionKey: 'pedidos' }, loadComponent: () => import('./features/dashboard/pedidos/detalle/detalle-pedido').then(m => m.DetallePedido) },
      { path: 'pedidos', data: { sectionKey: 'pedidos' }, loadComponent: listado },
      { path: 'productos', data: { sectionKey: 'productos' }, loadComponent: catalogo },
      { path: 'seguimiento/:id', data: { sectionKey: 'seguimiento' }, loadComponent: () => import('./features/dashboard/pedidos/seguimiento/seguimiento').then(m => m.Seguimiento) },
      { path: 'seguimiento', data: { sectionKey: 'seguimiento' }, loadComponent: () => import('./features/dashboard/pedidos/seguimiento/seguimiento').then(m => m.Seguimiento) },
      { path: 'perfil', loadComponent: () => import('./features/dashboard/perfil/perfil-cliente').then(m => m.PerfilCliente) },
      ...['seguridad', 'preferencias', 'ayuda'].map(pagina => ({ path: pagina, data: { pagina }, loadComponent: opcionesCuenta })),
    ],
  },
  {
    path: 'dashboard', title: 'without · Gestión', data: { area: 'staff' },
    canActivate: [authGuard], canActivateChild: [authGuard],
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout').then(m => m.DashboardLayout),
    children: [
      { path: '', pathMatch: 'full', data: { vistaRol: 'inicio' }, loadComponent: vistaRol },
      { path: 'perfil', loadComponent: () => import('./features/dashboard/perfil/perfil-trabajador').then(m => m.Perfil) },
      // Personal: cambiar contraseña y preferencias (tema, formato de fecha). El centro de ayuda es solo del cliente por ahora.
      ...['seguridad', 'preferencias'].map(pagina => ({ path: pagina, data: { pagina }, loadComponent: opcionesCuenta })),
      { path: 'trabajadores/nuevo', data: { sectionKey: 'trabajadores', roles: ['ADMIN'], modoTrabajador: 'crear' }, loadComponent: () => import('./features/dashboard/trabajadores/formulario/formulario-trabajador').then(m => m.FormularioTrabajador) },
      { path: 'trabajadores/:id/editar', data: { sectionKey: 'trabajadores', roles: ['ADMIN'], modoTrabajador: 'editar' }, loadComponent: () => import('./features/dashboard/trabajadores/formulario/formulario-trabajador').then(m => m.FormularioTrabajador) },
      { path: 'trabajadores/:id', data: { sectionKey: 'trabajadores', roles: ['ADMIN'], modoTrabajador: 'ver' }, loadComponent: () => import('./features/dashboard/trabajadores/formulario/formulario-trabajador').then(m => m.FormularioTrabajador) },
      { path: 'trabajadores', data: { sectionKey: 'trabajadores', roles: ['ADMIN'] }, loadComponent: () => import('./features/dashboard/trabajadores/listar/listar-trabajadores').then(m => m.ListadoTrabajadores) },
      { path: 'productos/nuevo', data: { sectionKey: 'productos', roles: ['ADMIN'] }, loadComponent: () => import('./features/dashboard/productos/formulario/formulario-producto').then(m => m.FormularioProducto) },
      { path: 'productos/:id/editar', data: { sectionKey: 'productos', roles: ['ADMIN'] }, loadComponent: () => import('./features/dashboard/productos/formulario/formulario-producto').then(m => m.FormularioProducto) },
      { path: 'atenciones/nueva', data: { sectionKey: 'atenciones', roles: ['PROGRAMADOR'] }, loadComponent: () => import('./features/dashboard/atenciones/formulario/formulario-atencion').then(m => m.ProgramarAtencion) },
      { path: 'atenciones/asignadas/:id', data: { sectionKey: 'atenciones', roles: ['CONDUCTOR'] }, loadComponent: () => import('./features/dashboard/atenciones/detalle/detalle-atencion').then(m => m.AtencionConductor) },
      { path: 'atenciones/:id/editar', data: { sectionKey: 'atenciones', roles: ['PROGRAMADOR'] }, loadComponent: () => import('./features/dashboard/atenciones/formulario/formulario-atencion').then(m => m.ProgramarAtencion) },
      { path: 'atenciones/:id/cancelar', data: { sectionKey: 'atenciones', roles: ['PROGRAMADOR'] }, loadComponent: () => import('./features/dashboard/atenciones/cancelar/cancelar-atencion').then(m => m.CancelarAtencion) },
      // Cada módulo abre la pantalla que dashboard-data.ts asigna al rol (o el listado genérico).
      ...sections.map(key => ({ path: key, data: { sectionKey: key, vistaRol: key }, loadComponent: vistaRol })),
    ],
  },
  {
    path: '', title: 'without', loadComponent: () => import('./layouts/public-layout/public-layout').then(m => m.PublicLayout),
    children: [
      { path: 'register', loadComponent: () => import('./features/auth/register/register').then(m => m.Register) },
      { path: 'login', loadComponent: () => import('./features/auth/login/login').then(m => m.Login) },
      { path: 'inicio', loadComponent: () => import('./features/inicio/inicio').then(m => m.Inicio) },
      { path: 'nosotros', loadComponent: () => import('./features/nosotros/nosotros').then(m => m.Nosotros) },
      { path: 'contacto', loadComponent: () => import('./features/contacto/contacto').then(m => m.Contacto) },
      { path: 'productos', loadComponent: () => import('./features/productos/productos').then(m => m.Producto) },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
