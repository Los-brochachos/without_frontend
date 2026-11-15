import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Auth } from '../auth/auth';

export type Tema = 'claro' | 'oscuro' | 'sistema';
export type FormatoFecha = 'dd/MM/yyyy' | 'yyyy-MM-dd';
const ESTADOS_CITA = ['PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA'];
/** Clase en <html> que activa el modo oscuro (styles.css y PrimeNG la usan). */
export const CLASE_OSCURO = 'app-oscuro';
const CLAVE_TEMA_PUBLICO = 'without-tema-publico';
/** Duración del cambio claro ↔ oscuro (debe coincidir con styles.css). */
const DURACION_TRANSICION_MS = 450;

/**
 * Cambia el tema suavemente:
 * - Navegadores con View Transitions (Chrome, Edge, Safari 18+): fundido de toda la pantalla.
 * - Resto: clase temporal `tema-cambiando` que anima fondos, textos y bordes.
 * Si el usuario pidió reducir el movimiento, el cambio es inmediato.
 */
function cambiarConTransicion(aplicar: () => void) {
  const html = document.documentElement;
  const reducir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (reducir) { aplicar(); return; }
  if (typeof doc.startViewTransition === 'function') { doc.startViewTransition(aplicar); return; }
  html.classList.add('tema-cambiando');
  aplicar();
  setTimeout(() => html.classList.remove('tema-cambiando'), DURACION_TRANSICION_MS);
}

function leerTemaPublico(): 'claro' | 'oscuro' {
  try { return localStorage.getItem(CLAVE_TEMA_PUBLICO) === 'oscuro' ? 'oscuro' : 'claro'; } catch { return 'claro'; }
}

/**
 * Preferencias del usuario, guardadas por cuenta en este navegador (localStorage).
 * - tema: claro / oscuro / según el sistema (aplica a toda la app).
 * - formato: formato de fecha usado por el pipe `fecha` en todas las pantallas.
 * - citasEstado: filtro inicial de «Citas» (solo cliente).
 * Sin sesión iniciada (sitio público) se usa `temaPublico`, que el visitante cambia con el botón sol/luna del navbar.
 */
@Injectable({ providedIn: 'root' })
export class PortalPreferencias {
  private readonly auth = inject(Auth);
  readonly formato = signal<FormatoFecha>('dd/MM/yyyy');
  readonly formatoHora = computed(() => this.formato() + ' HH:mm');
  readonly citasEstado = signal('TODAS');
  readonly tema = signal<Tema>('claro');
  /** Si el sistema operativo está en oscuro (para la opción «sistema»). */
  private readonly sistemaOscuro = signal(false);
  /** Tema del sitio público (sin sesión), guardado en este navegador. */
  readonly temaPublico = signal<'claro' | 'oscuro'>(leerTemaPublico());
  /** Con sesión manda el tema de la cuenta; sin sesión, el del sitio público. */
  readonly oscuroActivo = computed(() => this.auth.usuario()
    ? this.tema() === 'oscuro' || (this.tema() === 'sistema' && this.sistemaOscuro())
    : this.temaPublico() === 'oscuro');

  constructor() {
    const consulta = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (consulta) {
      this.sistemaOscuro.set(consulta.matches);
      const alCambiar = (e: MediaQueryListEvent) => this.sistemaOscuro.set(e.matches);
      consulta.addEventListener?.('change', alCambiar);
      inject(DestroyRef).onDestroy(() => consulta.removeEventListener?.('change', alCambiar));
    }
    // Cargar las preferencias de la cuenta que inició sesión.
    effect(() => {
      const id = this.auth.usuario()?.idUsuario;
      let datos: { formato?: string; citasEstado?: string; tema?: string } = {};
      try { datos = JSON.parse(localStorage.getItem(`without-preferencias-${id}`) || '{}') || {}; } catch { /* Conserva los valores predeterminados. */ }
      this.formato.set(datos.formato === 'yyyy-MM-dd' ? 'yyyy-MM-dd' : 'dd/MM/yyyy');
      this.citasEstado.set(ESTADOS_CITA.includes(datos.citasEstado || '') ? datos.citasEstado! : 'TODAS');
      this.tema.set(datos.tema === 'oscuro' || datos.tema === 'sistema' ? datos.tema : 'claro');
    });
    // Aplicar el tema a toda la aplicación.
    // La primera vez se aplica al instante (sin parpadeo al cargar); los cambios posteriores, con transición.
    let primeraVez = true;
    effect(() => {
      if (typeof document === 'undefined') return;
      const oscuro = this.oscuroActivo();
      const html = document.documentElement;
      if (html.classList.contains(CLASE_OSCURO) === oscuro) { primeraVez = false; return; }
      const aplicar = () => { html.classList.toggle(CLASE_OSCURO, oscuro); html.style.colorScheme = oscuro ? 'dark' : 'light'; };
      if (primeraVez) { primeraVez = false; aplicar(); return; }
      cambiarConTransicion(aplicar);
    });
  }

  /** Botón sol/luna: sin sesión cambia el tema público; con sesión, el tema de la cuenta. */
  alternarTema() {
    const oscuro = !this.oscuroActivo();
    if (this.auth.usuario()) { this.guardar(this.formato(), this.citasEstado(), oscuro ? 'oscuro' : 'claro'); return; }
    this.temaPublico.set(oscuro ? 'oscuro' : 'claro');
    try { localStorage.setItem(CLAVE_TEMA_PUBLICO, this.temaPublico()); } catch { /* Sin almacenamiento: dura hasta recargar. */ }
  }

  guardar(formato: string, citasEstado: string, tema: Tema = this.tema()) {
    localStorage.setItem(`without-preferencias-${this.auth.usuario()?.idUsuario}`, JSON.stringify({ formato, citasEstado, tema }));
    this.formato.set(formato === 'yyyy-MM-dd' ? 'yyyy-MM-dd' : 'dd/MM/yyyy');
    this.citasEstado.set(citasEstado);
    this.tema.set(tema);
  }
}
