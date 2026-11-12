import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Subject, switchMap, catchError, of } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../../core/services/api.service';
import { PedidoService } from '../../../../core/services/pedido/pedido-service';
import { SeguimientoPedidoService } from '../../../../core/services/pedido/seguimiento-pedido-service';
import { PedidoResponse, DetallePedidoResponse, SeguimientoPedidoResponse } from '../../../../core/models/PedidoModel';
import { AtencionResponse } from '../../../../core/models/AtencionModel';

import { FechaPipe } from '../../../../core/pipes/fecha.pipe';
@Component({ selector: 'app-pedidos-programador', imports: [FechaPipe, CommonModule, RouterLink, InputTextModule, ReactiveFormsModule], templateUrl: './listar-pedidos-programador.html' })
export class PedidosProgramador {
  private readonly api = inject(ApiService);
  private readonly pedidosApi = inject(PedidoService);
  private readonly seguimientoApi = inject(SeguimientoPedidoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly seleccionar = new Subject<PedidoResponse>();
  readonly pedidos = signal<PedidoResponse[]>([]);
  readonly atenciones = signal<AtencionResponse[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly consulta = signal('');
  readonly estado = signal('TODOS');
  readonly estados = ['RECIBIDO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
  readonly pagina = signal(1);
  readonly seleccionado = signal<PedidoResponse | null>(null);
  readonly detalles = signal<DetallePedidoResponse[]>([]);
  readonly seguimiento = signal<SeguimientoPedidoResponse[]>([]);
  readonly cargandoDetalle = signal(false);
  readonly errorDetalle = signal('');
  readonly errorSeguimiento = signal('');
  // Cancelación del pedido desde el detalle
  readonly mostrarCancelacion = signal(false);
  readonly cancelando = signal(false);
  readonly errorCancelacion = signal('');
  readonly mensajeDetalle = signal('');
  readonly cancelacion = inject(FormBuilder).nonNullable.group({
    observacion: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(250)]],
  });
  readonly filtrados = computed(() => this.pedidos().filter(p =>
    (this.estado() === 'TODOS' || p.estado === this.estado()) &&
    [p.idPedido, p.razonSocial, p.prioridad, p.estado].some(v => String(v ?? '').toLocaleLowerCase().includes(this.consulta().trim().toLocaleLowerCase())))
    .sort((a, b) => b.idPedido - a.idPedido));
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / 10)));
  readonly actual = computed(() => Math.min(this.pagina(), this.paginas()));
  readonly visibles = computed(() => this.filtrados().slice((this.actual() - 1) * 10, this.actual() * 10));
  readonly pendientes = computed(() => this.pedidos().filter(p => this.puedeProgramar(p)).length);
  /** Historial del más reciente al más antiguo. */
  readonly historial = computed(() => [...this.seguimiento()].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)));

  constructor() {
    this.seleccionar.pipe(switchMap(p => {
      this.seleccionado.set(p); this.detalles.set([]); this.seguimiento.set([]);
      this.errorDetalle.set(''); this.errorSeguimiento.set(''); this.cargandoDetalle.set(true);
      this.mostrarCancelacion.set(false); this.errorCancelacion.set(''); this.mensajeDetalle.set(''); this.cancelacion.reset();
      // Productos y seguimiento se piden juntos; si uno falla, el otro igual se muestra.
      return forkJoin({
        detalles: this.api.get<DetallePedidoResponse[]>(`pedidos/${p.idPedido}/detalles/activos`).pipe(catchError(() => {
          this.errorDetalle.set('No se pudieron consultar los productos del pedido.'); return of([] as DetallePedidoResponse[]);
        })),
        seguimiento: this.seguimientoApi.todos(p.idPedido).pipe(catchError(() => {
          this.errorSeguimiento.set('No se pudo consultar el seguimiento del pedido.'); return of([] as SeguimientoPedidoResponse[]);
        })),
      });
    }), takeUntilDestroyed(this.destroyRef)).subscribe(r => {
      this.detalles.set(r.detalles); this.seguimiento.set(r.seguimiento); this.cargandoDetalle.set(false);
      // Con el contenido ya cargado el panel crece: se vuelve a alinear arriba.
      this.irAlDetalle(false);
    });
    this.cargar();
  }
  activa(p: PedidoResponse) { return this.atenciones().find(a => a.idPedido === p.idPedido && ['PROGRAMADA', 'EN_CURSO'].includes(a.estado)); }
  puedeProgramar(p: PedidoResponse) { return ['RECIBIDO', 'EN_PREPARACION'].includes(p.estado) && !this.activa(p); }
  /** Reglas del backend: RECIBIDO o EN_PREPARACION y sin atención EN_CURSO (las PROGRAMADAS se cancelan con el pedido). */
  puedeCancelar(p: PedidoResponse) { return ['RECIBIDO', 'EN_PREPARACION'].includes(p.estado) && this.activa(p)?.estado !== 'EN_CURSO'; }
  ver(p: PedidoResponse) {
    this.seleccionar.next(p);
    this.irAlDetalle(true);
  }
  /** El panel está debajo del listado: lleva la vista hasta él (y enfoca su título al abrirlo). */
  private irAlDetalle(enfocar: boolean) {
    afterNextRender(() => {
      const panel = document.getElementById('detalle-pedido');
      const reducir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel?.scrollIntoView?.({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
      if (enfocar) panel?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
  cargar() {
    if (this.cargando()) return;
    this.cargando.set(true); this.error.set('');
    forkJoin({ pedidos: this.api.get<PedidoResponse[]>('pedidos'), atenciones: this.api.get<AtencionResponse[]>('atenciones') })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => { this.pedidos.set(data.pedidos); this.atenciones.set(data.atenciones); this.cargando.set(false); },
        error: () => { this.error.set('No se pudieron cargar los pedidos y sus programaciones. Intenta nuevamente.'); this.cargando.set(false); },
      });
  }

  cancelarPedido() {
    const p = this.seleccionado();
    if (!p || this.cancelando() || !this.puedeCancelar(p)) return;
    this.cancelacion.markAllAsTouched();
    if (this.cancelacion.invalid) return;
    this.cancelando.set(true); this.errorCancelacion.set('');
    this.pedidosApi.cancelar(p.idPedido, this.cancelacion.getRawValue().observacion.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: actualizado => {
        this.cancelando.set(false); this.mostrarCancelacion.set(false);
        this.pedidos.update(lista => lista.map(x => x.idPedido === actualizado.idPedido ? { ...x, ...actualizado } : x));
        // Recarga productos + seguimiento (nuevo registro CANCELADO) y las atenciones (las PROGRAMADAS se cancelaron).
        this.ver({ ...p, ...actualizado });
        this.mensajeDetalle.set(`Pedido #${actualizado.idPedido} cancelado.`);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.cancelando.set(false);
        this.errorCancelacion.set(e.status === 400 ? (e.error?.message || 'Este pedido ya no se puede cancelar.')
          : e.status === 403 ? 'No tienes permiso para cancelar pedidos.'
          : e.status === 401 ? 'Tu sesión ha vencido. Vuelve a iniciar sesión.'
          : 'No se pudo confirmar la cancelación. Actualiza el listado antes de repetirla.');
      },
    });
  }
}
