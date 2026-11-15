import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { ClienteResponse } from '../../../../core/models/ClienteModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { tieneRol } from '../../../../core/auth/access';
import { Paginacion } from '../../compartido/listado/paginacion';

/** Empresas cliente registradas (ADMIN y ANALISTA). GET /clientes. */
@Component({ selector: 'app-listar-clientes', imports: [RouterLink, InputTextModule, FechaPipe, Paginacion], templateUrl: './listar-clientes.html' })
export class ListarClientes extends ListadoBase<ClienteResponse> {
  /** ADMIN (y SUPERADMIN): botón Editar y estado de la cuenta. */
  readonly puedeEditar = tieneRol(this.rolActual, 'ADMIN');
  protected fuente(): FuenteListado { return { path: 'clientes' }; }
  protected coincide(c: ClienteResponse, texto: string): boolean {
    return [String(c.idCliente), c.razonSocial, c.ruc, c.correo, c.telefono, c.direccion]
      .some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
}
