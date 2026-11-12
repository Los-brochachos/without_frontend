import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Auth } from '../auth/auth';

export type Tema = 'claro' | 'oscuro' | 'sistema';
export type FormatoFecha = 'dd/MM/yyyy' | 'yyyy-MM-dd';
const ESTADOS_CITA = ['PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA'];
/** Clase en <html> que activa el modo oscuro (styles.css y PrimeNG la usan). */
export const CLASE_OSCURO = 'app-oscuro';

/**
 * Preferencias del usuario, guardadas por cuenta en este navegador (localStorage).
 * - tema: claro / oscuro / según el sistema (aplica a toda la app).
 * - formato: formato de fecha usado por el pipe `fecha` en todas las pantallas.
 * - citasEstado: filtro inicial de «Citas» (solo cliente).
 * Sin sesión iniciada se usa el tema claro (sitio público).
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
  readonly oscuroActivo = computed(() => !!this.auth.usuario() && (this.tema() === 'oscuro' || (this.tema() === 'sistema' && this.sistemaOscuro())));

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
    effect(() => {
      if (typeof document === 'undefined') return;
      const oscuro = this.oscuroActivo();
      document.documentElement.classList.toggle(CLASE_OSCURO, oscuro);
      document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
    });
  }

  guardar(formato: string, citasEstado: string, tema: Tema = this.tema()) {
    localStorage.setItem(`without-preferencias-${this.auth.usuario()?.idUsuario}`, JSON.stringify({ formato, citasEstado, tema }));
    this.formato.set(formato === 'yyyy-MM-dd' ? 'yyyy-MM-dd' : 'dd/MM/yyyy');
    this.citasEstado.set(citasEstado);
    this.tema.set(tema);
  }
}
