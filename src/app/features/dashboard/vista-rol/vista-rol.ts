import { NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, Type, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, distinctUntilChanged, from, map, of, switchMap, tap } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { seccionDe } from '../dashboard-data';

/**
 * El router conserva este contenedor y cada rol ve su propia pantalla.
 * Qué pantalla abre cada rol se define en dashboard-data.ts (campo `pantalla`); no hay `if` por rol aquí.
 */
@Component({
  selector: 'app-vista-rol', imports: [NgComponentOutlet],
  template: `@if (error()) { <p role="alert" class="p-6 text-red-700">{{ error() }}</p> }
    @else if (componente(); as vista) { <ng-container *ngComponentOutlet="vista" /> }
    @else { <p role="status" class="p-6">Cargando pantalla…</p> }`,
})
export class VistaRol {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly componente = signal<Type<unknown> | null>(null);
  readonly error = signal('');
  constructor() {
    combineLatest([this.route.data, toObservable(this.auth.usuario)]).pipe(
      map(([data, usuario]) => ({ vista: data['vistaRol'] as string, rol: usuario?.rol || '' })),
      distinctUntilChanged((a, b) => a.vista === b.vista && a.rol === b.rol),
      tap(() => { this.componente.set(null); this.error.set(''); }),
      switchMap(({ vista, rol }) => !rol ? of(null) : from(this.cargar(vista, rol)).pipe(catchError(() => {
        this.error.set('No se pudo cargar la pantalla. Recarga la página para intentarlo nuevamente.'); return of(null);
      }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(componente => this.componente.set(componente));
  }
  private cargar(vista: string, rol: string): Promise<Type<unknown>> {
    // El resumen de inicio es la única vista que no es un módulo del menú.
    if (vista === 'inicio') return rol === 'PROGRAMADOR'
      ? import('../inicio/inicio-programador').then(m => m.InicioProgramador)
      : import('../inicio/resumen').then(m => m.Dashboard);
    const pantalla = seccionDe(rol, vista)?.pantalla;
    if (!pantalla) throw new Error(`El rol ${rol} no tiene la sección ${vista}`);
    return pantalla();
  }
}
