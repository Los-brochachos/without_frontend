import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { CatalogoProductos } from './listar-productos';

const productos = [{ idProducto: 1, nombre: 'Oxígeno medicinal', tipoGas: 'O2', unidadMedida: 'm3', precioUnitario: 8.5, estado: 'ACTIVO' }];

describe('Catálogo de productos (cliente y programador)', () => {
  async function setup(rol: string) {
    await TestBed.configureTestingModule({ imports: [CatalogoProductos], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { usuario: signal({ rol }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(CatalogoProductos);
    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/productos/activos')).flush(productos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  async function setupAdmin() {
    await TestBed.configureTestingModule({ imports: [CatalogoProductos], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { usuario: signal({ rol: 'ADMIN' }), getAccessToken: () => 'token' } }] }).compileComponents();
    const fixture = TestBed.createComponent(CatalogoProductos);
    const http = TestBed.inject(HttpTestingController);
    // ADMIN pide TODOS (incluye inactivos), no solo los activos.
    http.expectOne(r => r.url.endsWith('/api/v1/productos')).flush([...productos, { ...productos[0], idProducto: 2, nombre: 'Argón', estado: 'INACTIVO' }]);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, http, vista: fixture.nativeElement as HTMLElement };
  }

  it('ADMIN ve Crear producto, filtro por estado y Editar/Desactivar en cada tarjeta', async () => {
    const { c, vista } = await setupAdmin();
    expect(c.conteo()).toEqual({ ACTIVO: 1, INACTIVO: 1, TODOS: 2 });
    expect(c.visibles().map(p => p.nombre)).toEqual(['Oxígeno medicinal']);   // arranca en Activos
    expect(vista.querySelector('a[href="/dashboard/productos/nuevo"]')).not.toBeNull();
    expect(vista.querySelector('a[href="/dashboard/productos/1/editar"]')).not.toBeNull();
    expect(vista.textContent).toContain('Desactivar');
    c.filtroEstado.set('INACTIVO');
    expect(c.visibles().map(p => p.nombre)).toEqual(['Argón']);
  });

  it('ADMIN desactiva un producto (DELETE) y pasa a Inactivos', async () => {
    const { c, http } = await setupAdmin();
    c.desactivar(c.productos()[0]);
    http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/productos/1')).flush(null);
    expect(c.productos()[0].estado).toBe('INACTIVO');
    expect(c.conteo().INACTIVO).toBe(2);
    expect(c.mensaje()).toContain('se desactivó');
  });

  it('programador no ve acciones de administración', async () => {
    const vista = await setup('PROGRAMADOR');
    expect(vista.textContent).not.toContain('Desactivar');
    expect(vista.querySelector('a[href="/dashboard/productos/nuevo"]')).toBeNull();
    expect(vista.querySelector('a[href*="/editar"]')).toBeNull();
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('el cliente ve el portal del cliente y el acceso a Crear pedido', async () => {
    const vista = await setup('CLIENTE');
    expect(vista.textContent).toContain('Portal del cliente');
    expect(vista.querySelector('a[href="/cliente/pedidos/nuevo"]')).not.toBeNull();
    expect(vista.textContent).toContain('Oxígeno medicinal');
  });

  it('el programador ve el mismo catálogo, sin el botón de Crear pedido', async () => {
    const vista = await setup('PROGRAMADOR');
    expect(vista.textContent).toContain('Catálogo · Operaciones');
    expect(vista.querySelector('a[href="/cliente/pedidos/nuevo"]')).toBeNull();
    expect(vista.textContent).toContain('Oxígeno medicinal');
  });
});
