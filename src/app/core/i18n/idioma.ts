import { Injectable, Pipe, PipeTransform, effect, inject, signal } from '@angular/core';
import { ES } from './es';
import { QU } from './qu';
import { QU_CONTENIDO } from './qu-contenido';

export type Idioma = 'es' | 'qu';
const CLAVE = 'without-idioma';
const DICCIONARIOS: Record<Idioma, Partial<Record<keyof typeof ES, string>>> = { es: ES, qu: QU };

/**
 * Traducción del portal (español / quechua sureño Cusco-Collao).
 * - Sin librerías: los textos viven en es.ts y qu.ts.
 * - Si falta una clave en quechua se muestra el español (respaldo), nunca la clave.
 * - La elección se guarda en este navegador y se refleja en <html lang> (lectores de pantalla).
 */
@Injectable({ providedIn: 'root' })
export class IdiomaService {
  readonly actual = signal<Idioma>(leer());

  constructor() {
    effect(() => {
      const idioma = this.actual();
      if (typeof document !== 'undefined') document.documentElement.lang = idioma;
      try { localStorage.setItem(CLAVE, idioma); } catch { /* Sin almacenamiento: dura hasta recargar. */ }
    });
  }

  alternar() { this.actual.update(i => (i === 'es' ? 'qu' : 'es')); }

  /**
   * Dos formas de clave:
   * - Clave corta de interfaz ('nav.inicio'): definida en es.ts / qu.ts.
   * - Texto de contenido en español (párrafos, tarjetas): se busca tal cual en QU_CONTENIDO.
   * En ambos casos, si no hay traducción se muestra el español.
   */
  t(clave: string): string {
    if (clave in ES) return DICCIONARIOS[this.actual()][clave as keyof typeof ES] ?? ES[clave as keyof typeof ES];
    return this.actual() === 'qu' ? QU_CONTENIDO[clave] ?? clave : clave;
  }
}

function leer(): Idioma {
  try { return localStorage.getItem(CLAVE) === 'qu' ? 'qu' : 'es'; } catch { return 'es'; }
}

/** Uso en plantillas: {{ 'nav.inicio' | t }}. Impuro para reaccionar al cambio de idioma (la búsqueda es O(1)). */
@Pipe({ name: 't', pure: false })
export class TraducirPipe implements PipeTransform {
  private readonly idioma = inject(IdiomaService);
  transform(clave: string): string { return this.idioma.t(clave); }
}
