import { Component, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { CisternaResponse } from '../../../../core/models/CisternaModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { tieneRol } from '../../../../core/auth/access';
import { Paginacion } from '../../compartido/listado/paginacion';

/**
 * Cisternas de la flota.
 * - ADMIN: todas (GET /cisternas), incluidas las dadas de baja, con acciones Crear y Editar.
 * - Resto de roles: solo las activas (GET /cisternas/activas).
 */
@Component({ selector: 'app-listar-cisternas', imports: [RouterLink, InputTextModule, DecimalPipe, Paginacion], templateUrl: './listar-cisternas.html' })
export class ListarCisternas extends ListadoBase<CisternaResponse> {
  readonly esAdmin = tieneRol(this.rolActual, 'ADMIN');
  /** Capacidad total de las cisternas activas. */
  readonly capacidadTotal = computed(() => this.filas().filter(c => c.estado !== 'INACTIVO').reduce((suma, c) => suma + Number(c.capacidad || 0), 0));
  protected fuente(): FuenteListado { return { path: this.esAdmin ? 'cisternas' : 'cisternas/activas' }; }
  protected coincide(c: CisternaResponse, texto: string): boolean {
    return [String(c.idCisterna), c.placa, c.nombre].some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
}
