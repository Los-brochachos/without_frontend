import { Injectable, signal } from '@angular/core';

export type TipoAlerta = 'info' | 'exito' | 'advertencia' | 'error';

export interface OpcionesAlerta {
  titulo: string;
  mensaje: string;
  tipo?: TipoAlerta;
  /** Texto del botón principal (por defecto «Aceptar»). */
  textoAceptar?: string;
  /** Si se indica, muestra también un botón secundario y `mostrar` resuelve false al pulsarlo. */
  textoCancelar?: string;
}

interface AlertaActiva extends Required<Omit<OpcionesAlerta, 'textoCancelar'>> { textoCancelar?: string; responder: (ok: boolean) => void }

/**
 * Modal de alertas de toda la aplicación (un solo <app-alerta-modal> en app.html).
 * Uso:  await alertas.mostrar({ titulo: 'Sesión cerrada', mensaje: '…', tipo: 'advertencia' });
 * Devuelve una promesa: true al aceptar, false al cancelar. Si llega otra alerta mientras hay una abierta, espera su turno.
 */
@Injectable({ providedIn: 'root' })
export class Alertas {
  readonly actual = signal<AlertaActiva | null>(null);
  private readonly cola: AlertaActiva[] = [];

  mostrar(opciones: OpcionesAlerta): Promise<boolean> {
    return new Promise(resolve => {
      const alerta: AlertaActiva = {
        tipo: 'info', textoAceptar: 'Aceptar', ...opciones,
        responder: ok => { resolve(ok); this.siguiente(); },
      };
      if (this.actual()) this.cola.push(alerta); else this.actual.set(alerta);
    });
  }

  /** Lo llama el componente al pulsar un botón. */
  responder(ok: boolean) { this.actual()?.responder(ok); }

  private siguiente() { this.actual.set(this.cola.shift() ?? null); }
}
