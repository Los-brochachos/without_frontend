import { DestroyRef, Injectable, NgZone, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { Auth } from './auth';
import { Alertas } from '../ui/alerta-modal/alertas';
import { environment } from '../../../environments/environment';

/** Minutos sin actividad (mouse, teclado, toque, scroll) tras los cuales se cierra la sesión. */
const MINUTOS_INACTIVIDAD = environment.inactividadMinutos;
/** Cada cuánto se revisa el estado de la sesión. */
const INTERVALO_REVISION_MS = 15_000;
/** Se renueva el access token cuando le queda menos de esto para vencer. */
const MARGEN_RENOVACION_MS = 2 * 60_000;
const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Momento (ms) en que vence el JWT, leído de su campo `exp`. null si no se puede leer. */
function vencimientoToken(token: string | null): number | null {
  try {
    const carga = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof carga.exp === 'number' ? carga.exp * 1000 : null;
  } catch { return null; }
}

/**
 * Mantiene la sesión mientras el usuario trabaja y la cierra si la abandona:
 * - Usuario ACTIVO: antes de que venza el access token (15 min) se pide uno nuevo con el refresh token
 *   (cookie HttpOnly). No hay cortes ni avisos.
 * - Usuario INACTIVO por más de `inactividadMinutos`: se cierra la sesión en el backend, se va al login
 *   y se muestra el modal «Tu sesión se cerró por inactividad».
 * Si el equipo estuvo suspendido, al volver la primera revisión detecta la inactividad y cierra la sesión.
 */
@Injectable({ providedIn: 'root' })
export class SesionInactividad {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly alertas = inject(Alertas);
  private readonly zona = inject(NgZone);
  private ultimaActividad = Date.now();
  private temporizador?: ReturnType<typeof setInterval>;
  private renovando = false;
  private cerrando = false;
  private readonly registrarActividad = () => { this.ultimaActividad = Date.now(); };

  constructor() {
    // Vigila solo mientras hay sesión iniciada.
    effect(() => (this.auth.usuario() ? this.iniciar() : this.detener()));
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  private iniciar() {
    if (this.temporizador || typeof window === 'undefined') return;
    this.ultimaActividad = Date.now();
    // Fuera de la zona de Angular: mover el mouse no dispara detección de cambios.
    this.zona.runOutsideAngular(() => {
      EVENTOS_ACTIVIDAD.forEach(e => window.addEventListener(e, this.registrarActividad, { passive: true, capture: true }));
      this.temporizador = setInterval(() => this.zona.run(() => this.revisar()), INTERVALO_REVISION_MS);
    });
    // Al volver a la pestaña se revisa enseguida (no espera al siguiente intervalo).
    document.addEventListener('visibilitychange', this.alVolver);
  }

  private detener() {
    clearInterval(this.temporizador); this.temporizador = undefined;
    if (typeof window === 'undefined') return;
    EVENTOS_ACTIVIDAD.forEach(e => window.removeEventListener(e, this.registrarActividad, { capture: true }));
    document.removeEventListener('visibilitychange', this.alVolver);
  }

  private readonly alVolver = () => { if (document.visibilityState === 'visible') this.zona.run(() => this.revisar()); };

  private revisar() {
    if (!this.auth.usuario() || this.cerrando) return;
    if (Date.now() - this.ultimaActividad >= MINUTOS_INACTIVIDAD * 60_000) { this.cerrarPorInactividad(); return; }
    // Activo: renovar en silencio si el token está por vencer.
    const vence = vencimientoToken(this.auth.getAccessToken());
    if (vence !== null && vence - Date.now() < MARGEN_RENOVACION_MS && !this.renovando) {
      this.renovando = true;
      this.auth.refreshSession().pipe(finalize(() => (this.renovando = false))).subscribe({
        // Si el refresh token también venció (30 días) o fue revocado, la sesión ya no es válida.
        error: () => this.cerrarSesion('Tu sesión expiró', 'Por seguridad, vuelve a iniciar sesión para continuar.'),
      });
    }
  }

  private cerrarPorInactividad() {
    this.cerrarSesion('Sesión cerrada por inactividad', `Tu sesión se cerró porque no hubo actividad durante ${MINUTOS_INACTIVIDAD} minutos. Inicia sesión nuevamente para continuar.`);
  }

  private cerrarSesion(titulo: string, mensaje: string) {
    if (this.cerrando) return;
    this.cerrando = true;
    this.detener();
    // Revoca el refresh token en el backend; si falla (sin red, ya vencido) igual se limpia la sesión local.
    this.auth.logout().pipe(catchError(() => of(null)), finalize(() => this.auth.clearSession())).subscribe(() => {
      void this.router.navigate(['/login']);
      void this.alertas.mostrar({ titulo, mensaje, tipo: 'advertencia', textoAceptar: 'Aceptar' }).then(() => (this.cerrando = false));
    });
  }
}
