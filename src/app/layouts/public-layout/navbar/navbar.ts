
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { PaginaIndice, buscarEnSitio, irAlTexto } from '../../../core/busqueda/busqueda';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { ButtonDirective } from 'primeng/button';
import { PortalPreferencias } from '../../../core/services/portal-preferencias';
import { IdiomaService, TraducirPipe } from '../../../core/i18n/idioma';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    DrawerModule,
    TraducirPipe,
  ],
  templateUrl: './navbar.html',
})
export class Navbar {

  private readonly router = inject(Router);
  /** Tema claro/oscuro (botón sol/luna). */
  readonly preferencias = inject(PortalPreferencias);
  /** Idioma del portal (botón ES/QU). */
  readonly idioma = inject(IdiomaService);

  // Estados del navbar
  menuAbierto = signal(false);
  buscadorAbierto = signal(false);
  busqueda = signal('');

  // Referencia al input de búsqueda
  @ViewChild('campoBusqueda') campoBusqueda?: ElementRef<HTMLInputElement>;

  // Abrir o cerrar menú móvil
  toggleMenu(): void {
    this.menuAbierto.update(valor => !valor);
    this.buscadorAbierto.set(false);
  }

  /** Índice del contenido público: se descarga la primera vez que se abre el buscador (no pesa en la carga inicial). */
  private readonly indice = signal<PaginaIndice[] | null>(null);
  /** Resultados en vivo, ordenados de la página más probable a la menos. Se recalculan al escribir o cambiar de idioma. */
  readonly resultados = computed(() => {
    const indice = this.indice(), consulta = this.busqueda();
    this.idioma.actual();
    return indice && consulta.trim().length >= 2 ? buscarEnSitio(consulta, indice, t => this.idioma.t(t)) : [];
  });
  readonly totalCoincidencias = computed(() => this.resultados().reduce((n, r) => n + r.coincidencias.length, 0));

  // Abrir o cerrar buscador
  toggleBuscador(): void {
    const abrir = !this.buscadorAbierto();

    this.buscadorAbierto.set(abrir);
    this.menuAbierto.set(false);

    if (abrir) {
      if (!this.indice()) void import('../../../core/busqueda/indice-busqueda').then(m => this.indice.set(m.INDICE_BUSQUEDA));
      setTimeout(() => {
        this.campoBusqueda?.nativeElement.focus();
      }, 0);
    }
  }

  /** Abre la página del resultado y lleva la vista hasta el texto encontrado. */
  abrirResultado(ruta: string, texto: string): void {
    this.cerrarPaneles();
    void this.router.navigateByUrl(ruta).then(() => irAlTexto(texto));
  }

  // Cerrar paneles
  cerrarPaneles(): void {
    this.menuAbierto.set(false);
    this.buscadorAbierto.set(false);
  }

  // Enter / botón Buscar: abre el resultado más relevante
  buscar(): void {
    const mejor = this.resultados()[0];
    if (mejor) this.abrirResultado(mejor.ruta, mejor.coincidencias[0].textoCompleto);
  }
}
