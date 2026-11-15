import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { ConductorResponse } from '../../../../core/models/TrabajadorModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { Paginacion } from '../../compartido/listado/paginacion';

/** Días de anticipación para avisar que una licencia está por vencer. */
export const DIAS_AVISO_LICENCIA = 30;

/** Conductores activos con su licencia (ADMIN, ANALISTA y PROGRAMADOR). GET /conductores/activos. */
@Component({ selector: 'app-listar-conductores', imports: [RouterLink, InputTextModule, FechaPipe, Paginacion], templateUrl: './listar-conductores.html' })
export class ListarConductores extends ListadoBase<ConductorResponse> {
  protected fuente(): FuenteListado { return { path: 'conductores/activos' }; }
  protected coincide(c: ConductorResponse, texto: string): boolean {
    return [`${c.nombres} ${c.apellidos}`, c.dni, c.correo, c.licenciaConducir, c.categoriaLicencia]
      .some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
  /** Situación de la licencia según su fecha de vencimiento. */
  licencia(c: ConductorResponse): { texto: string; clase: string } {
    if (!c.fechaVencimientoLicencia) return { texto: 'Sin fecha', clase: 'bg-slate-100 text-slate-600' };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(`${c.fechaVencimientoLicencia}T00:00:00`).getTime() - hoy.getTime()) / 86_400_000);
    if (dias < 0) return { texto: 'Vencida', clase: 'bg-red-50 text-red-700' };
    if (dias <= DIAS_AVISO_LICENCIA) return { texto: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, clase: 'bg-amber-50 text-amber-700' };
    return { texto: 'Vigente', clase: 'bg-emerald-50 text-emerald-700' };
  }
  categoria(valor: string | null | undefined): string { return valor ? valor.replace('_', '-') : '—'; }
}
