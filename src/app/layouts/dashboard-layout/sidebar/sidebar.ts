
import {
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation
} from '@angular/core';

import { IsActiveMatchOptions, Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, filter, map, of, startWith, switchMap } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { Auth } from '../../../core/auth/auth';
import { ClienteService } from '../../../core/services/cliente/cliente-service';
import { ApiService } from '../../../core/services/api.service';
import { DASHBOARD_ROLES, ItemMenu, rutaSeccion } from '../../../features/dashboard/dashboard-data';

/** Entrada del menú ya resuelta para el rol actual (sale de dashboard-data.ts). */
export interface SeccionMenu { key: string; title: string; route: string; icono: string; children: ItemMenu[]; matches: boolean }

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, InputTextModule],
  templateUrl: './sidebar.html',
  encapsulation: ViewEncapsulation.None,
  styles: `



      /* ENLACES Y BOTONES */
      .without-sidebar-link {
        position: relative;
        border: 0;
        border-radius: 6px;
        transition: background-color 0.2s ease, color 0.2s ease;
      }

      /* ENLACE NORMAL SELECCIONADO */
      .without-sidebar-link.without-sidebar-active {
        background: #07365f !important;
        color: #ffffff !important;
        font-weight: 600;
      }

      /* GRUPO PEDIDOS ACTIVO: SOLO LÍNEA IZQUIERDA */
      .without-sidebar-group.without-sidebar-active {
        background: transparent !important;
        box-shadow: none !important;
        color: #ffffff !important;
      }

      /* INDICADOR LATERAL */
      .without-sidebar-link.without-sidebar-active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 18%;
        width: 3px;
        height: 64%;
        background: #38bdf8;
        border-radius: 0 3px 3px 0;
      }

      /* ICONOS */
      .without-sidebar-link.without-sidebar-active > i:first-child {
        color: #ffffff !important;
      }

      /* HOVER */
      .without-sidebar-link:not(.without-sidebar-active):hover {
        background: #094272 !important;
      }

      /* SUBOPCIÓN ACTIVA */
      .without-sidebar-subitem.without-sidebar-active {
        background: #07365f !important;
        color: #ffffff !important;
      }

      /* SCROLLBAR */
      app-sidebar ::-webkit-scrollbar {
        width: 5px;
      }

      app-sidebar ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.35);
        border-radius: 8px;
      }

      app-sidebar ::-webkit-scrollbar-track {
        background: transparent;
      }

  `
})
export class Sidebar {

  private readonly router = inject(Router);
  /** Ruta exacta pero sin mirar ?query: así «Crear atención» sigue marcado en /atenciones/nueva?pedido=52. */
  readonly activoExacto: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };
  readonly usuario = inject(Auth).usuario;
  readonly search = signal('');
  readonly rutaActual = signal(this.router.url.split(/[?#]/)[0]);
  /** Grupos desplegados por el usuario (por key de sección). */
  private readonly abiertos = signal<ReadonlySet<string>>(new Set());

  /** Un grupo está activo si la ruta actual está dentro de su sección (p. ej. /dashboard/atenciones/nueva). */
  activo(section: SeccionMenu) { return this.rutaActual() === section.route || this.rutaActual().startsWith(section.route + '/'); }
  abierto(key: string) { return !!this.search().trim() || this.abiertos().has(key); }
  toggleGrupo(key: string) {
    this.abiertos.update(actual => { const s = new Set(actual); if (s.has(key)) s.delete(key); else s.add(key); return s; });
  }
  /** Al navegar, se despliega el grupo de la sección actual (sin cerrar los que abrió el usuario). */
  private abrirActivo() {
    const activa = this.sections().find(s => s.children.length && this.activo(s));
    if (activa && !this.abiertos().has(activa.key)) this.abiertos.update(actual => new Set(actual).add(activa.key));
  }

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(event => { this.rutaActual.set(event.urlAfterRedirects.split(/[?#]/)[0]); this.abrirActivo(); });
    queueMicrotask(() => this.abrirActivo());
  }

  readonly isClient = computed(() =>
    this.usuario()?.rol === 'CLIENTE'
  );

  readonly home = computed(() =>
    this.isClient() ? '/cliente/inicio' : '/dashboard'
  );

  readonly profile = computed(() =>
    this.isClient() ? '/cliente/perfil' : '/dashboard/perfil'
  );


  readonly logoError = signal(false);

  private readonly api = inject(ApiService);
  private readonly clientes = inject(ClienteService);
  private readonly nombrePerfil = toSignal(combineLatest([toObservable(this.usuario), toObservable(this.clientes.revision)]).pipe(
    switchMap(([usuario]) => {
      if (!usuario) return of('');
      const cliente = usuario.rol === 'CLIENTE';
      return this.api.get<{ razonSocial?: string; nombres?: string; apellidos?: string }>(cliente ? 'clientes/me' : 'trabajadores/me').pipe(
        map(perfil => cliente ? (perfil.razonSocial?.trim() ?? '') : [perfil.nombres, perfil.apellidos].map(valor => valor?.trim()).filter(Boolean).join(' ')),
        catchError(() => of('')),
        startWith(''),
      );
    }),
  ), { initialValue: '' });
  readonly empresaNombre = computed(() => this.nombrePerfil() || this.usuario()?.correo || 'Mi cuenta');

  readonly empresaLogoUrl = signal<string | null>(null);

  readonly empresaLogo = computed(() =>
    this.logoError() ? null : this.empresaLogoUrl()
  );


  /** Menú del rol actual, tal como lo define dashboard-data.ts (un rol sin el módulo no lo ve). */
  readonly sections = computed<SeccionMenu[]>(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const rol = this.usuario()?.rol;
    return (DASHBOARD_ROLES[rol ?? '']?.sections ?? []).map(section => {
      const matches = section.menu.toLocaleLowerCase().includes(query);
      return {
        key: section.key, title: section.menu, route: rutaSeccion(rol, section.key), icono: section.icono, matches,
        children: section.hijos.filter(hijo => matches || hijo.titulo.toLocaleLowerCase().includes(query)),
      };
    }).filter(section => section.matches || section.children.length > 0);
  });
}
