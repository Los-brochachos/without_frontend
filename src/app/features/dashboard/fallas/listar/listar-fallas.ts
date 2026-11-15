import { Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { FallaResponse } from '../../../../core/models/CisternaModel';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { tieneRol } from '../../../../core/auth/access';
import { Paginacion } from '../../compartido/listado/paginacion';

/** Fallas reportadas en las cisternas (ADMIN, ANALISTA y TÉCNICO). GET /fallas. */
@Component({ selector: 'app-listar-fallas', imports: [RouterLink, InputTextModule, FechaPipe, Paginacion], templateUrl: './listar-fallas.html' })
export class ListarFallas extends ListadoBase<FallaResponse> {
  readonly estados = ['PENDIENTE', 'EN_REPARACION', 'RESUELTA'];
  /** Cuántas fallas hay en cada estado (tarjetas del encabezado). */
  readonly resumen = computed(() => this.estados.map(e => ({ estado: e, total: this.filas().filter(f => f.estado === e).length })));
  /** Solo el técnico cambia estados y reporta fallas (PATCH /fallas/estado, POST /fallas). */
  readonly esTecnico = tieneRol(this.rolActual, 'TECNICO');
  /** Reportar asigna la falla al técnico autenticado (el SUPERADMIN tiene su propio perfil de técnico). */
  readonly puedeReportar = tieneRol(this.rolActual, 'TECNICO');
  /** Falla cuyo cambio de estado está en curso (deshabilita sus botones). */
  readonly procesando = signal<number | null>(null);

  /**
   * Inicia la reparación (PENDIENTE → EN_REPARACION).
   * El paso a RESUELTA no se hace aquí: exige registrar el mantenimiento (el botón «Marcar resuelta» lleva a ese formulario
   * y el backend rechaza resolver una falla sin historial).
   */
  avanzar(f: FallaResponse) {
    const siguiente = f.estado === 'PENDIENTE' ? 'EN_REPARACION' : null;
    if (!siguiente || this.procesando()) return;
    this.procesando.set(f.idFalla); this.aviso.set('');
    this.api.patch<FallaResponse>('fallas/estado', { idFalla: f.idFalla, estado: siguiente }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.procesando.set(null); this.aviso.set(`Falla #${f.idFalla} actualizada a ${this.texto(siguiente)}.`); this.actualizar(); },
      error: e => { this.procesando.set(null); this.aviso.set(''); alert(e.status === 400 ? (e.error?.message || 'No se pudo cambiar el estado.') : 'No se pudo cambiar el estado de la falla. Actualiza el listado e inténtalo de nuevo.'); },
    });
  }

  protected fuente(): FuenteListado { return { path: 'fallas' }; }
  protected coincide(f: FallaResponse, texto: string): boolean {
    return [String(f.idFalla), String(f.idCisterna), f.descripcion].some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
}
