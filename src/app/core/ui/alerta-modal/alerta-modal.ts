import { Component, computed, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { Alertas, TipoAlerta } from './alertas';

const ESTILO: Record<TipoAlerta, { icono: string; color: string }> = {
  info: { icono: 'pi pi-info-circle', color: 'bg-sky-50 text-[#0077cc]' },
  exito: { icono: 'pi pi-check-circle', color: 'bg-emerald-50 text-emerald-600' },
  advertencia: { icono: 'pi pi-clock', color: 'bg-amber-50 text-amber-600' },
  error: { icono: 'pi pi-times-circle', color: 'bg-red-50 text-red-600' },
};

/**
 * Presentación del modal de alertas (PrimeNG Dialog). Se coloca una sola vez en app.html.
 * No se cierra con Escape ni haciendo clic fuera: el usuario debe confirmar que leyó el aviso.
 */
@Component({
  selector: 'app-alerta-modal',
  imports: [DialogModule],
  template: `
    <p-dialog [visible]="!!alertas.actual()" [modal]="true" [closable]="false" [closeOnEscape]="false" [dismissableMask]="false"
      [draggable]="false" [resizable]="false" [showHeader]="false" [blockScroll]="true"
      styleClass="without-alerta" [style]="{ width: '26rem', maxWidth: 'calc(100vw - 2rem)' }"
      [attr.aria-labelledby]="'alerta-titulo'" role="alertdialog">
      @if (alertas.actual(); as a) {
        <div class="flex flex-col items-center px-2 pb-1 pt-6 text-center">
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full" [class]="estilo().color">
            <i [class]="estilo().icono + ' text-3xl'" aria-hidden="true"></i>
          </div>
          <h2 id="alerta-titulo" class="text-lg font-bold text-[#002d54]">{{ a.titulo }}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ a.mensaje }}</p>
          <div class="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            @if (a.textoCancelar) {
              <button type="button" (click)="alertas.responder(false)" class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">{{ a.textoCancelar }}</button>
            }
            <button type="button" (click)="alertas.responder(true)" autofocus class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#007ac3] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#0064a3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007ac3]">{{ a.textoAceptar }}</button>
          </div>
        </div>
      }
    </p-dialog>
  `,
})
export class AlertaModal {
  readonly alertas = inject(Alertas);
  readonly estilo = computed(() => ESTILO[this.alertas.actual()?.tipo ?? 'info']);
}
