import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { AtencionConductor } from './detalle-atencion';

const atencion = (estado: string) => ({ idAtencion: 7, estado, idPedido: 3, idConductor: 3, idCisterna: 1, idProgramador: 2,
  fechaInicioProgramada: '2026-11-12T08:00:00', fechaFinProgramada: null, fechaInicio: null, fechaFin: null, observaciones: null });
const alerta = (idAlerta: number, estado: string, fechaHora: string) => ({ idAlerta, estado, fechaHora, tipo: 'RETRASO', mensaje: 'Tráfico', idAtencion: 7 });

describe('CONDUCTOR · Detalle de atención e incidencias', () => {
  async function setup(estado: string, alertas: unknown[] = []) {
    await TestBed.configureTestingModule({ imports: [AtencionConductor], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: '7' })) } },
      { provide: Auth, useValue: { usuario: signal({ rol: 'CONDUCTOR' }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(AtencionConductor);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(r => r.url.endsWith('/atenciones/asignadas/7')).flush(atencion(estado));
    http.expectOne(r => r.url.endsWith('/atenciones/asignadas')).flush([atencion(estado)]);
    http.expectOne(r => r.url.endsWith('/alertas/atencion/7')).flush(alertas);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, http, vista: fixture.nativeElement as HTMLElement };
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('muestra las incidencias de la atención, la más reciente primero, con su estado', async () => {
    const { c, vista } = await setup('EN_CURSO', [alerta(1, 'ATENDIDA', '2026-11-12T09:00:00'), alerta(2, 'PENDIENTE', '2026-11-12T10:00:00')]);
    expect(c.alertas().map(a => a.idAlerta)).toEqual([2, 1]);
    expect(vista.textContent).toContain('Pendiente de revisión');
    expect(vista.textContent).toContain('Atendida');
  });

  it('EN_CURSO: reporta una incidencia (POST /alertas) y aparece arriba como pendiente', async () => {
    const { c, http } = await setup('EN_CURSO');
    c.mostrarReporte.set(true);
    c.reportar();
    expect(http.match(() => true)).toHaveLength(0);                 // sin tipo ni mensaje no envía
    c.reporte.setValue({ tipo: 'RETRASO', mensaje: '  Tráfico intenso  ' });
    c.reportar();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/alertas'));
    expect(req.request.body).toEqual({ tipo: 'RETRASO', mensaje: 'Tráfico intenso', idAtencion: 7 });
    req.flush(alerta(9, 'PENDIENTE', '2026-11-12T11:00:00'));
    expect(c.alertas()[0].idAlerta).toBe(9);
    expect(c.mostrarReporte()).toBe(false);
    expect(c.mensaje()).toContain('#9');
  });

  it('PROGRAMADA: no ofrece reportar (el backend solo lo permite EN_CURSO)', async () => {
    const { c, http, vista } = await setup('PROGRAMADA');
    expect(vista.textContent).not.toContain('Reportar incidencia');
    expect(vista.textContent).toContain('cuando inicies la atención');
    c.reporte.setValue({ tipo: 'RETRASO', mensaje: 'x' });
    c.reportar();
    expect(http.match(() => true)).toHaveLength(0);
  });

  it('muestra el motivo si el backend rechaza el reporte', async () => {
    const { c, http } = await setup('EN_CURSO');
    c.reporte.setValue({ tipo: 'OTRO', mensaje: 'x' });
    c.reportar();
    http.expectOne(r => r.method === 'POST').flush({ message: 'Solo se puede registrar una alerta durante una atención EN_CURSO' }, { status: 400, statusText: 'Bad Request' });
    expect(c.errorReporte()).toContain('EN_CURSO');
    expect(c.reportando()).toBe(false);
  });

  it('si fallan las alertas, la atención igual se muestra', async () => {
    await TestBed.configureTestingModule({ imports: [AtencionConductor], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: '7' })) } },
      { provide: Auth, useValue: { usuario: signal({ rol: 'CONDUCTOR' }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(AtencionConductor);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(r => r.url.endsWith('/atenciones/asignadas/7')).flush(atencion('EN_CURSO'));
    http.expectOne(r => r.url.endsWith('/atenciones/asignadas')).flush([]);
    http.expectOne(r => r.url.endsWith('/alertas/atencion/7')).flush({}, { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.atencion()?.idAtencion).toBe(7);
    expect(fixture.componentInstance.errorAlertas()).toContain('incidencias');
  });
});
