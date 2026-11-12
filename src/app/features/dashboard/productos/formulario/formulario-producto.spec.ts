import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { FormularioProducto } from './formulario-producto';

describe('ADMIN · Formulario de producto', () => {
  async function setup(id?: string) {
    await TestBed.configureTestingModule({ imports: [FormularioProducto], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      { provide: Auth, useValue: { usuario: signal({ rol: 'ADMIN' }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(FormularioProducto);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return { fixture, c: fixture.componentInstance, http: TestBed.inject(HttpTestingController), navigate };
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('crear: valida, envía POST con datos limpios y vuelve al catálogo', async () => {
    const { c, http, navigate } = await setup();
    c.guardar();
    expect(http.match(() => true)).toHaveLength(0);           // inválido: no envía
    c.form.setValue({ nombre: '  Helio  ', tipoGas: 'He', unidadMedida: 'm3', precioUnitario: 12.5 });
    c.guardar();
    const req = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/productos'));
    expect(req.request.body).toEqual({ nombre: 'Helio', tipoGas: 'He', unidadMedida: 'm3', precioUnitario: 12.5 });
    req.flush({ idProducto: 9, nombre: 'Helio', tipoGas: 'He', unidadMedida: 'm3', precioUnitario: 12.5, estado: 'ACTIVO' });
    expect(navigate).toHaveBeenCalledWith(['/dashboard/productos']);
  });

  it('precio con más de 2 decimales o cero es inválido', async () => {
    const { c } = await setup();
    c.form.controls.precioUnitario.setValue(0);
    expect(c.form.controls.precioUnitario.invalid).toBe(true);
    c.form.controls.precioUnitario.setValue(1.234);
    expect(c.form.controls.precioUnitario.invalid).toBe(true);
  });

  it('editar: carga el producto y envía PUT', async () => {
    const { c, http } = await setup('4');
    http.expectOne(r => r.url.endsWith('/productos/4')).flush({ idProducto: 4, nombre: 'Oxígeno', tipoGas: 'O2', unidadMedida: 'm3', precioUnitario: 8.5, estado: 'ACTIVO' });
    expect(c.esEdicion()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('Oxígeno');
    c.form.controls.precioUnitario.setValue(9);
    c.guardar();
    const req = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/productos/4'));
    expect(req.request.body.precioUnitario).toBe(9);
    req.flush({});
  });

  it('muestra el mensaje del backend si el nombre ya existe', async () => {
    const { c, http } = await setup();
    c.form.setValue({ nombre: 'Oxígeno', tipoGas: 'O2', unidadMedida: 'm3', precioUnitario: 8 });
    c.guardar();
    http.expectOne(r => r.method === 'POST').flush({ message: 'Ya existe un producto con ese nombre' }, { status: 400, statusText: 'Bad Request' });
    expect(c.error()).toContain('Ya existe');
    expect(c.guardando()).toBe(false);
  });
});
