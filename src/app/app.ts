import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { PortalPreferencias } from './core/services/portal-preferencias';
import { AlertaModal } from './core/ui/alerta-modal/alerta-modal';
import { SesionInactividad } from './core/auth/sesion-inactividad';


@Component({
  imports: [RouterOutlet, ButtonModule, AlertaModal],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('without-frontend');

  constructor() {
    // Se crea al iniciar la app para aplicar el tema (claro/oscuro) y el formato de fecha de la cuenta en todas las pantallas.
    inject(PortalPreferencias);
    // Renueva el token mientras el usuario trabaja y cierra la sesión si queda inactiva (con aviso en el modal de alertas).
    inject(SesionInactividad);

    // Al entrar a otra pantalla la vista vuelve arriba. Solo cuenta el cambio de ruta:
    // cambiar ?q=, ?pagina= o ?estado= (búsqueda, filtros) no mueve el scroll.
    let rutaAnterior = '';
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(url => {
      const ruta = url.split(/[?#]/)[0];
      if (ruta === rutaAnterior || url.includes('#')) { rutaAnterior = ruta; return; }
      rutaAnterior = ruta;
      window.scrollTo?.(0, 0);
      // En dashboard/cliente el scroll lo hace <main data-scroll-principal>, no la ventana.
      document.querySelectorAll<HTMLElement>('[data-scroll-principal]').forEach(el => el.scrollTop = 0);
    });
  }
}
