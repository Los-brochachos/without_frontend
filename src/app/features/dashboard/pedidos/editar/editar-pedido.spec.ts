import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { EditarPedido } from './editar-pedido';

const pedido = (id = 10, estado = 'RECIBIDO') => ({ idPedido: id, estado, prioridad: 'ALTA', fechaRegistro: '2026-11-10', fechaEntregaEstimada: '2026-11-15', idCliente: 3 });
// precioUnitario guardado (9) distinto del catálogo (10): el resumen debe usar el guardado.
const oxigeno = { idDetalle: 20, idProducto: 1, nombreProducto: 'Oxígeno', cantidad: 2, precioUnitario: 9, estado: 'ACTIVO' };
const nitrogeno = { idDetalle: 21, idProducto: 2, nombreProducto: 'Nitrógeno', cantidad: 1, precioUnitario: 5, estado: 'ACTIVO' };
const productos = [
  { idProducto: 1, nombre: 'Oxígeno', tipoGas: 'O2', unidadMedida: 'm3', precioUnitario: 10, estado: 'ACTIVO' },
  { idProducto: 2, nombre: 'Nitrógeno', tipoGas: 'N2', unidadMedida: 'm3', precioUnitario: 5, estado: 'ACTIVO' },
  { idProducto: 3, nombre: 'Argón', tipoGas: 'Ar', unidadMedida: 'm3', precioUnitario: 7, estado: 'ACTIVO' },
];
const pagina = (contenido: unknown[]) => ({ contenido, pagina: 0, tamanio: 50, totalElementos: contenido.length, totalPaginas: 1, primera: true, ultima: true });

describe('EditarPedido (cliente)', () => {
  async function setup(id: string | null) {
    const params = new BehaviorSubject(convertToParamMap(id ? { id } : {}));
    await TestBed.configureTestingModule({ imports: [EditarPedido], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: Auth, useValue: { usuario: signal({ rol: 'CLIENTE' }), getAccessToken: () => 'token' } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(EditarPedido);
    return { fixture, c: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }
  function base(http: HttpTestingController, editables = [pedido(10), pedido(12)]) {
    http.expectOne(r => r.url.endsWith('/pedidos/mis-pedidos/paginado?pagina=0&tamanio=50&estado=RECIBIDO')).flush(pagina(editables));
    http.expectOne(r => r.url.endsWith('/productos/activos')).flush(productos);
  }
  function cargarPedido(http: HttpTestingController, estado = 'RECIBIDO', detalles = [oxigeno, nitrogeno]) {
    // Coherente con el backend: un pedido no RECIBIDO no aparece entre los editables.
    base(http, estado === 'RECIBIDO' ? [pedido(10), pedido(12)] : [pedido(12)]);
    http.expectOne(r => r.url.endsWith('/pedidos/mis-pedidos/10')).flush(pedido(10, estado));
    http.expectOne(r => r.url.endsWith('/pedidos/10/detalles')).flush(detalles);
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  it('sin pedido elegido, el selector ofrece solo los pedidos RECIBIDO', async () => {
    const { c, http } = await setup(null);
    base(http);
    expect(c.pedido()).toBeNull();
    expect(c.opciones().map(o => o.id)).toEqual([10, 12]);
    expect(c.opciones()[0].etiqueta).toContain('Pedido #10');
  });

  it('elegir un pedido en el selector navega a su URL de edición', async () => {
    const { c, http } = await setup(null);
    base(http);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.seleccion.setValue(12);
    expect(navigate).toHaveBeenCalledWith(['/cliente/pedidos', 12, 'editar']);
  });

  it('carga el pedido en el mismo formulario: productos registrados bloqueados y precio guardado', async () => {
    const { c, http } = await setup('10');
    cargarPedido(http);
    expect(c.seleccion.value).toBe(10);
    expect(c.detalles.length).toBe(2);
    expect(c.detalles.at(0).controls.idProducto.disabled).toBe(true);
    expect(c.totalEstimado()).toBe(2 * 9 + 1 * 5);
    expect(c.cambios()).toEqual([]);
  });

  it('guardar calcula la diferencia y llama en orden: agregar, sumar y al final quitar', async () => {
    const { c, http } = await setup('10');
    cargarPedido(http);
    c.agregar();
    c.detalles.at(2).patchValue({ idProducto: 3, cantidad: 4 });
    c.detalles.at(0).controls.cantidad.setValue(3.5);   // 2 → 3.5 = sumar 1.5
    c.quitar(1);                                         // quitar Nitrógeno
    expect(c.cambios()).toEqual(['Agregar Argón × 4', 'Sumar 1.5 a Oxígeno', 'Quitar Nitrógeno']);
    c.guardar();

    const post = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/pedidos/10/detalles'));
    expect(post.request.body).toEqual({ idProducto: 3, cantidad: 4 });
    post.flush({ idDetalle: 22, idProducto: 3, nombreProducto: 'Argón', cantidad: 4, precioUnitario: 7, estado: 'ACTIVO' });
    const mas = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/detalles/20/cantidad'));
    expect(mas.request.body).toEqual({ cantidad: 1.5 });
    mas.flush({ ...oxigeno, cantidad: 3.5 });
    http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/detalles/21/cancelar')).flush({ ...nitrogeno, estado: 'INACTIVO' });

    // Recarga el estado real del pedido después de guardar.
    cargarPedido(http, 'RECIBIDO', [{ ...oxigeno, cantidad: 3.5 }, { idDetalle: 22, idProducto: 3, nombreProducto: 'Argón', cantidad: 4, precioUnitario: 7, estado: 'ACTIVO' }]);
    expect(c.mensaje()).toContain('Pedido #10 actualizado (3 cambios)');
    expect(c.cambios()).toEqual([]);
  });

  it('no permite reducir una cantidad ya registrada', async () => {
    const { c, http } = await setup('10');
    cargarPedido(http);
    c.detalles.at(0).controls.cantidad.setValue(1);
    expect(c.detalles.at(0).errors?.['menorQueOriginal']).toBe(2);
    c.guardar();
    expect(http.match(() => true)).toHaveLength(0);
    expect(c.error()).toContain('no reduzcas');
  });

  it('sin cambios no envía nada', async () => {
    const { c, http } = await setup('10');
    cargarPedido(http);
    c.guardar();
    expect(http.match(() => true)).toHaveLength(0);
    expect(c.mensaje()).toBe('No hay cambios por guardar.');
  });

  it('si el backend rechaza un cambio, recarga y mantiene visible el error', async () => {
    const { c, http } = await setup('10');
    cargarPedido(http);
    c.detalles.at(0).controls.cantidad.setValue(3);
    c.guardar();
    http.expectOne(r => r.url.endsWith('/detalles/20/cantidad'))
      .flush({ message: 'Solo se pueden modificar los detalles de un pedido en estado RECIBIDO' }, { status: 400, statusText: 'Bad Request' });
    cargarPedido(http, 'EN_PREPARACION');
    expect(c.error()).toContain('estado RECIBIDO');
    expect(c.editable()).toBe(false);
  });

  it('un pedido que ya no está RECIBIDO se muestra bloqueado y sin botón de guardar', async () => {
    const { fixture, c, http } = await setup('10');
    cargarPedido(http, 'EN_PREPARACION');
    fixture.detectChanges();
    expect(c.form.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('ya no se puede editar');
    expect(fixture.nativeElement.textContent).not.toContain('Guardar cambios');
    expect(c.opciones()[0].etiqueta).toContain('(no editable)');
  });
});
