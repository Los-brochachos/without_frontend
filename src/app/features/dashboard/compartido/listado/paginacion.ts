import { Component, input, output } from '@angular/core';

/** Pie de tabla con el total y los botones Anterior / Siguiente (lo usan todos los listados). */
@Component({
  selector: 'app-paginacion',
  template: `
    <div class="flex flex-col justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
      <p class="text-xs text-slate-500">{{ total() }} resultados encontrados</p>
      <div class="flex items-center justify-between gap-4 sm:justify-end">
        <button type="button" (click)="cambiar.emit(pagina() - 1)" [disabled]="pagina() <= 1"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#002d54] transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40">
          <i class="pi pi-chevron-left text-[10px]"></i> Anterior
        </button>
        <span class="whitespace-nowrap text-xs font-semibold text-slate-600">
          Página <span class="text-[#002d54]">{{ pagina() }}</span> de {{ paginas() }}
        </span>
        <button type="button" (click)="cambiar.emit(pagina() + 1)" [disabled]="pagina() >= paginas()"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#002d54] transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40">
          Siguiente <i class="pi pi-chevron-right text-[10px]"></i>
        </button>
      </div>
    </div>`,
})
export class Paginacion {
  readonly pagina = input.required<number>();
  readonly paginas = input.required<number>();
  readonly total = input.required<number>();
  readonly cambiar = output<number>();
}
