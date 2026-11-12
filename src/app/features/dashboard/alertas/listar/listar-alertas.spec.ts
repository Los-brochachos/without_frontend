import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { AlertasOperacion } from './listar-alertas';
import { AlertaResponse, EstadoAlerta } from '../../../../core/models/AlertaModel';

const alerta = (idAlerta: number, estado: EstadoAlerta, fechaHora = '2026-11-10T10:00:00'): AlertaResponse =>
  ({ idAlerta, estado, fechaHora, tipo: 'RETRASO' as const, mensaje: `Mensaje ${idAlerta}`, idAtencion: 5 });

describe('Alertas de operación (compartida)', () => {
  async function setup(alertas = [alerta(1, 'PENDIENTE'), alerta(2, 'REVISADA'), alerta(3, 'ATENDIDA'), alerta(4, 'PENDIENTE', '2026-11-11T09:00:00')], rol = 'PROGRAMADOR') {
    await TestBed.configureTestingModule({ imports: [AlertasOperacion], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { usuario: signal({ rol }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(AlertasOperacion);
    const http = TestBed.inject(HttpTestingController);
    // El conductor consulta solo las suyas (mis-alertas); el resto, todas.
    http.expectOne(r => r.url.endsWith(rol === 'CONDUCTOR' ? '/api/v1/alertas/mis-alertas' : '/api/v1/alertas')).flush(alertas);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, http };
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('abre en Pendientes, la más reciente primero, con conteo por estado', async () => {
    const { c } = await setup();
    expect(c.visibles().map(a => a.idAlerta)).toEqual([4, 1]);
    expect(c.conteo()).toEqual({ TODAS: 4, PENDIENTE: 2, REVISADA: 1, ATENDIDA: 1 });
  });

  it('cada estado ofrece solo su acción siguiente', async () => {
    const { fixture, c } = await setup();
    c.filtrar('TODAS'); fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto.match(/Marcar revisada/g)).toHaveLength(2);
    expect(texto.match(/Marcar atendida/g)).toHaveLength(1);
    expect(texto).toContain('Cerrada');
  });

  it('Marcar revisada llama a PATCH /revisar y actualiza la fila', async () => {
    const { c, http } = await setup();
    c.revisar(alerta(1, 'PENDIENTE'));
    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/alertas/1/revisar')).flush(alerta(1, 'REVISADA'));
    expect(c.alertas().find(a => a.idAlerta === 1)?.estado).toBe('REVISADA');
    expect(c.mensaje()).toContain('revisada');
    expect(c.conteo().PENDIENTE).toBe(1);
  });

  it('Marcar atendida llama a PATCH /atender', async () => {
    const { c, http } = await setup();
    c.atender(alerta(2, 'REVISADA'));
    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/alertas/2/atender')).flush(alerta(2, 'ATENDIDA'));
    expect(c.alertas().find(a => a.idAlerta === 2)?.estado).toBe('ATENDIDA');
  });

  it('si otro usuario ya la cambió (400), muestra el motivo y recarga', async () => {
    const { c, http } = await setup();
    c.revisar(alerta(1, 'PENDIENTE'));
    http.expectOne(r => r.url.endsWith('/alertas/1/revisar'))
      .flush({ message: 'Solo se puede revisar una alerta PENDIENTE' }, { status: 400, statusText: 'Bad Request' });
    expect(c.error()).toContain('PENDIENTE');
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/api/v1/alertas')).flush([alerta(1, 'REVISADA')]);
    expect(c.alertas()[0].estado).toBe('REVISADA');
  });

  it.each(['ADMIN', 'ANALISTA', 'CONDUCTOR'])('%s ve las mismas alertas, sin columna de acciones', async rol => {
    const { fixture, c, http } = await setup(undefined, rol);
    expect(c.puedeGestionar()).toBe(false);
    expect(c.filtro()).toBe('TODAS');
    expect(c.visibles()).toHaveLength(4);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('Marcar revisada');
    expect(texto).not.toContain('Acción');
    c.revisar(alerta(1, 'PENDIENTE'));          // aunque se invoque, no llama al backend
    expect(http.match(() => true)).toHaveLength(0);
  });

  it('busca por número de atención o mensaje', async () => {
    const { c } = await setup();
    c.filtrar('TODAS'); c.buscar('Mensaje 3');
    expect(c.visibles().map(a => a.idAlerta)).toEqual([3]);
  });
});
