import { Component, computed, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OpcionEdicion } from './edicion-base';

const normalizar = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * «¿Qué quieres editar?»: campo de búsqueda + <select> nativo (mismo diseño que el resto de selectores,
 * ver «SELECTORES» en styles.css). La búsqueda filtra las opciones por número, nombre, RUC, etc.
 * Lo usan todas las pantallas Editar … (y Editar pedido del cliente, sin tarjeta).
 */
@Component({
  selector: 'app-selector-edicion',
  imports: [ReactiveFormsModule],
  template: `
    <div [class]="tarjeta() ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6' : ''">
      <label [for]="inputId()" class="mb-2 flex items-center gap-2 text-sm font-semibold text-[#002d54]">
        <i class="pi pi-pencil text-xs text-[#0077cc]" aria-hidden="true"></i>{{ etiqueta() }}
      </label>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <!-- BUSCAR (filtra la lista) -->
        <div class="relative">
          <i class="pi pi-search pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true"></i>
          <input type="search" [value]="filtro()" (input)="filtro.set($any($event.target).value)" [placeholder]="ayudaFiltro()"
            [attr.aria-label]="'Buscar en la lista: ' + etiqueta()" [attr.aria-controls]="inputId()"
            class="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0077cc] focus:outline-none focus:ring-2 focus:ring-sky-100" />
        </div>
        <!-- SELECTOR -->
        <select [id]="inputId()" [formControl]="control()" [attr.aria-busy]="cargando()"
          class="h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#0077cc] focus:outline-none focus:ring-2 focus:ring-sky-100">
          <option [ngValue]="null" disabled>{{ textoVacio() }}</option>
          @for (o of visibles(); track o.id) {
            <option [ngValue]="o.id">{{ o.etiqueta }}</option>
          }
        </select>
      </div>
      <p class="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <i class="pi pi-info-circle" aria-hidden="true"></i>
        @if (filtro().trim()) { {{ visibles().length }} de {{ opciones().length }} coinciden con «{{ filtro().trim() }}». }
        @else { {{ ayuda() }} }
      </p>
    </div>
  `,
})
export class SelectorEdicion {
  readonly control = input.required<FormControl<number | null>>();
  readonly opciones = input.required<OpcionEdicion[]>();
  readonly cargando = input(false);
  readonly etiqueta = input('¿Qué registro quieres editar?');
  readonly placeholder = input('Selecciona un registro');
  readonly ayudaFiltro = input('Buscar…');
  readonly vacio = input('No hay registros para editar');
  readonly ayuda = input('Escribe en «Buscar» para encontrarlo más rápido.');
  readonly inputId = input('selector-edicion');
  /** false = sin borde ni fondo (cuando ya está dentro de otra tarjeta). */
  readonly tarjeta = input(true);

  readonly filtro = signal('');
  /** Opciones que coinciden con la búsqueda; la elegida se mantiene siempre visible. */
  readonly visibles = computed(() => {
    const texto = normalizar(this.filtro().trim());
    if (!texto) return this.opciones();
    const elegido = this.control().value;
    return this.opciones().filter(o => o.id === elegido || normalizar(o.etiqueta).includes(texto));
  });
  readonly textoVacio = computed(() => this.cargando() ? 'Cargando…'
    : !this.opciones().length ? this.vacio()
    : this.filtro().trim() && !this.visibles().length ? 'Ningún registro coincide con la búsqueda'
    : this.placeholder());
}
