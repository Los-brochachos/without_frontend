import { DatePipe } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { PortalPreferencias } from '../services/portal-preferencias';

/**
 * Formatea fechas con el formato elegido en Preferencias (dd/MM/yyyy o yyyy-MM-dd).
 * Uso: {{ valor | fecha }}  ·  {{ valor | fecha:true }} (con hora).
 * Es impuro para reflejar al instante un cambio de preferencia.
 */
@Pipe({ name: 'fecha', pure: false })
export class FechaPipe implements PipeTransform {
  private readonly preferencias = inject(PortalPreferencias);
  private readonly date = new DatePipe(inject(LOCALE_ID));
  transform(valor: string | Date | null | undefined, conHora = false): string | null {
    if (valor === null || valor === undefined || valor === '') return null;
    return this.date.transform(valor, conHora ? this.preferencias.formatoHora() : this.preferencias.formato());
  }
}
