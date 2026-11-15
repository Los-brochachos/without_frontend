
import {
  Component,
  computed,
  inject,
  ViewEncapsulation
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { RippleModule } from 'primeng/ripple';
import { Auth } from '../../../core/auth/auth';
import { PortalPreferencias } from '../../../core/services/portal-preferencias';

@Component({
  selector: 'app-header',
  imports: [MenuModule, RouterLink, RippleModule],
  templateUrl: './header.html',
  encapsulation: ViewEncapsulation.None,
  styles: `
    .without-user-menu {
      width: 304px !important;
      max-width: calc(100vw - 24px) !important;
      padding: 6px !important;
      margin-top: 8px !important;
      background: #ffffff !important;
      color: #334155 !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 14px !important;
      box-shadow:
        0 12px 32px -8px rgba(15, 23, 42, 0.15),
        0 4px 8px -4px rgba(15, 23, 42, 0.08) !important;
      overflow: hidden;
    }

    .without-user-menu .p-menu-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px !important;
      margin: 0 !important;
    }

    .without-user-menu .p-menu-item {
      margin: 0 !important;
    }

    .without-user-menu .p-menu-item-content {
      border-radius: 8px !important;
      background: transparent !important;
      transition: background-color 150ms ease;
    }

    .without-user-menu .p-menu-item-content:hover {
      background: transparent !important;
    }

    .without-user-menu .p-menu-item.p-focus > .p-menu-item-content {
      background: #f1f5f9 !important;
    }

    .without-user-menu .without-menu-link {
      width: 100%;
      padding: 10px !important;
      border-radius: 8px !important;
      text-decoration: none;
      outline-offset: -2px;
    }

    .without-user-menu .without-menu-link:focus-visible {
      outline: 2px solid #0077cc;
    }

    .without-user-menu .p-menu-separator {
      margin: 6px 8px !important;
      border-color: #e2e8f0 !important;
    }
  `
})
export class Header {

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  /** Botón sol/luna del header. */
  readonly preferencias = inject(PortalPreferencias);

  readonly usuario = this.auth.usuario;

  readonly items = computed<MenuItem[]>(() => {

    const esCliente = this.usuario()?.rol === 'CLIENTE';
    const base = esCliente ? '/cliente' : '/dashboard';

    const items: MenuItem[] = [
      {
        label: 'Mi perfil',
        icon: 'pi pi-user',
        description: 'Información personal',
        routerLink: `${base}/perfil`
      },
      {
        label: 'Seguridad',
        icon: 'pi pi-shield',
        description: 'Contraseña y acceso',
        routerLink: `${base}/seguridad`
      },
      {
        label: 'Preferencias',
        icon: 'pi pi-cog',
        description: 'Personalizar el portal',
        routerLink: `${base}/preferencias`
      },
      ...(esCliente ? [
        {
          label: 'Centro de ayuda',
          icon: 'pi pi-question-circle',
          description: 'Preguntas frecuentes',
          routerLink: `${base}/ayuda`
        }
      ] : []),
      {
        separator: true
      },
      {
        label: 'Cerrar sesión',
        icon: 'pi pi-sign-out',
        command: () => this.cerrarSesion()
      }
    ];

    return items;
  });

  cerrarSesion(): void {
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigateByUrl('/login');
      },
      error: () => {
        console.error('No se pudo cerrar la sesión');
      }
    });
  }
}
