import { Component, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
import { AtencionFormularioBase } from '../formulario/atencion-formulario-base';
import { OpcionEdicion } from '../../compartido/edicion/edicion-base';
import { SelectorEdicion } from '../../compartido/edicion/selector-edicion';

/**
 * PROGRAMADOR · Atenciones · Editar atención. PATCH /atenciones/{id} (solo atenciones PROGRAMADAS).
 * Rutas: /dashboard/atenciones/editar (selector con búsqueda) y /dashboard/atenciones/:id/editar.
 * Mismo patrón que Editar pedido: elegir otra atención en el selector cambia la URL.
 */
@Component({ selector: 'app-editar-atencion', imports: [FechaPipe, ReactiveFormsModule, RouterLink, InputTextModule, SelectorEdicion], templateUrl: './editar-atencion.html' })
export class EditarAtencion extends AtencionFormularioBase {
  readonly seleccion = new FormControl<number | null>(null);
  /** Solo las atenciones PROGRAMADAS se pueden editar. */
  readonly opciones = computed<OpcionEdicion[]>(() => this.atenciones()
    .filter(a => a.estado === 'PROGRAMADA')
    .sort((a, b) => a.fechaInicioProgramada.localeCompare(b.fechaInicioProgramada))
    .map(a => ({ id: a.idAtencion, etiqueta: `Atención #${a.idAtencion} · Pedido #${a.idPedido} · ${a.fechaInicioProgramada.replace('T', ' ').slice(0, 16)}` })));

  constructor() {
    super();
    this.seleccion.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      if (id && id !== this.idEdicion()) void this.router.navigate(['/dashboard/atenciones', id, 'editar']);
    });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cargar());
  }

  cargar() {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw === null ? null : Number(raw);
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) { this.cargando.set(false); this.errorCarga.set('El identificador de la atención no es válido.'); return; }
    this.seleccion.setValue(id, { emitEvent: false });
    this.cargarDatos(id);
  }
}
