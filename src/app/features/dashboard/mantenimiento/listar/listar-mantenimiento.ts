import { Component, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { HistorialMantenimientoResponse } from '../../../../core/models/CisternaModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { tieneRol } from '../../../../core/auth/access';
import { Paginacion } from '../../compartido/listado/paginacion';

/** Historial de mantenimiento de las cisternas (ADMIN, ANALISTA y TÉCNICO). GET /historial. */
@Component({ selector: 'app-listar-mantenimiento', imports: [RouterLink, InputTextModule, FechaPipe, CurrencyPipe, Paginacion], templateUrl: './listar-mantenimiento.html' })
export class ListarMantenimiento extends ListadoBase<HistorialMantenimientoResponse> {
  /** Costo de los registros que pasan el filtro actual. */
  readonly costoTotal = computed(() => this.filtrados().reduce((suma, h) => suma + Number(h.costo || 0), 0));
  /** Técnico o superadmin (POST /historial no exige perfil de técnico). */
  readonly puedeRegistrar = tieneRol(this.rolActual, 'TECNICO');
  protected fuente(): FuenteListado { return { path: 'historial' }; }
  protected coincide(h: HistorialMantenimientoResponse, texto: string): boolean {
    return [String(h.idHistorial), String(h.idCisterna), h.descripcion, h.resultado, h.observaciones]
      .some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
}
