import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { PedidosProgramador } from './listar-pedidos-programador';

const pedido = (idPedido: number, estado: string) => ({ idPedido, estado, prioridad: 'ALTA', fechaRegistro: '2026-11-10', fechaEntregaEstimada: '2026-11-15', idCliente: 3, razonSocial: 'Clínica Norte' });
const atencion = (idPedido: number, estado: string) => ({ idAtencion: 70 + idPedido, idPedido, estado });
const seguimiento = [
  { idSeguimiento: 1, fechaHora: '2026-11-10T08:00:00', estado: 'RECIBIDO', observacion: 'Pedido registrado', idPedido: 10 },
  { idSeguimiento: 2, fechaHora: '2026-11-10T09:00:00', estado: 'EN_PREPARACION', observacion: 'Atención programada', idPedido: 10 },
];

describe('PedidosProgramador: seguimiento y cancelación', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [PedidosProgramador], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { usuario: signal({ rol: 'PROGRAMADOR' }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(PedidosProgramador);
    const http = TestBed.inject(HttpTestingController);
    cargarListas(http);
    return { fixture, c: fixture.componentInstance, http };
  }
  function cargarListas(http: HttpTestingController, estado10 = 'EN_PREPARACION') {
    http.expectOne(r => r.url.endsWith('/api/v1/pedidos')).flush([pedido(10, estado10), pedido(11, 'RECIBIDO'), pedido(12, 'DESPACHADO')]);
    http.expectOne(r => r.url.endsWith('/api/v1/atenciones')).flush([atencion(10, 'PROGRAMADA'), atencion(12, 'EN_CURSO')]);
  }
  function abrir(c: PedidosProgramador, http: HttpTestingController, id = 10, estado = 'EN_PREPARACION') {
    c.ver(pedido(id, estado));
    http.expectOne(r => r.url.endsWith(`/pedidos/${id}/detalles/activos`)).flush([]);
    http.expectOne(r => r.url.endsWith(`/pedidos/${id}/seguimiento/todos`)).flush(id === 10 ? seguimiento : []);
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('Ver detalle carga productos y seguimiento; el historial va del más reciente al más antiguo', async () => {
    const { c, http } = await setup();
    abrir(c, http);
    expect(c.historial().map(s => s.estado)).toEqual(['EN_PREPARACION', 'RECIBIDO']);
  });

  it('si falla el seguimiento, los productos igual se muestran', async () => {
    const { c, http } = await setup();
    c.ver(pedido(11, 'RECIBIDO'));
    http.expectOne(r => r.url.endsWith('/pedidos/11/detalles/activos')).flush([{ idDetalle: 1, nombreProducto: 'Oxígeno', cantidad: 1, precioUnitario: 5, estado: 'ACTIVO', idProducto: 1 }]);
    http.expectOne(r => r.url.endsWith('/pedidos/11/seguimiento/todos')).flush({}, { status: 500, statusText: 'Error' });
    expect(c.detalles()).toHaveLength(1);
    expect(c.errorSeguimiento()).toContain('seguimiento');
  });

  it('reglas de cancelación: no con atención EN_CURSO ni DESPACHADO', async () => {
    const { c } = await setup();
    expect(c.puedeCancelar(pedido(10, 'EN_PREPARACION'))).toBe(true);   // atención PROGRAMADA: se cancela junto
    expect(c.puedeCancelar(pedido(11, 'RECIBIDO'))).toBe(true);
    expect(c.puedeCancelar(pedido(12, 'DESPACHADO'))).toBe(false);
  });

  it('cancelar exige motivo y envía PATCH /pedidos/{id}/cancelar', async () => {
    const { c, http } = await setup();
    abrir(c, http);
    c.cancelarPedido();
    expect(http.match(() => true)).toHaveLength(0);       // sin motivo no envía
    c.cancelacion.setValue({ observacion: '  Cliente desistió  ' });
    c.cancelarPedido();
    const req = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/pedidos/10/cancelar'));
    expect(req.request.body).toEqual({ observacion: 'Cliente desistió' });
    req.flush(pedido(10, 'CANCELADO'));
    // Recarga detalle (con el nuevo registro CANCELADO) y las listas.
    http.expectOne(r => r.url.endsWith('/pedidos/10/detalles/activos')).flush([]);
    http.expectOne(r => r.url.endsWith('/pedidos/10/seguimiento/todos')).flush([...seguimiento, { idSeguimiento: 3, fechaHora: '2026-11-10T10:00:00', estado: 'CANCELADO', observacion: 'Cliente desistió', idPedido: 10 }]);
    cargarListas(http, 'CANCELADO');
    expect(c.mensajeDetalle()).toContain('cancelado');
    expect(c.historial()[0].estado).toBe('CANCELADO');
    expect(c.pedidos().find(p => p.idPedido === 10)?.estado).toBe('CANCELADO');
  });

  it('muestra el mensaje del backend si rechaza la cancelación', async () => {
    const { c, http } = await setup();
    abrir(c, http);
    c.cancelacion.setValue({ observacion: 'x' });
    c.cancelarPedido();
    http.expectOne(r => r.url.endsWith('/pedidos/10/cancelar'))
      .flush({ message: 'No se puede cancelar un pedido con una atención EN_CURSO' }, { status: 400, statusText: 'Bad Request' });
    expect(c.errorCancelacion()).toContain('EN_CURSO');
    expect(c.cancelando()).toBe(false);
  });
});
