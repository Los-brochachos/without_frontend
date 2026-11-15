import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Type, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { ListarPedidos } from '../../pedidos/listar/listar-pedidos';
import { MisPedidos } from '../../pedidos/listar/mis-pedidos';
import { ListarUsuarios } from '../../usuarios/listar/listar-usuarios';
import { ListarConductores } from '../../conductores/listar/listar-conductores';
import { ListarFallas } from '../../fallas/listar/listar-fallas';

describe('Listados propios por módulo (paginación, filtros en la URL y errores)', () => {
  async function setup<C>(componente: Type<C>, rol = 'ADMIN') {
    const params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({ imports: [componente], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      { provide: Auth, useValue: { usuario: signal({ rol }), getAccessToken: () => 'token' } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(componente);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, http: TestBed.inject(HttpTestingController), params };
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });
  const pagina = (contenido: unknown[], extra: Record<string, unknown> = {}) =>
    ({ contenido, pagina: 0, tamanio: 10, totalElementos: contenido.length, totalPaginas: contenido.length ? 1 : 0, primera: true, ultima: true, ...extra });

  it('Usuarios: consulta una vez y pagina/busca en memoria desde la URL', async () => {
    const { c, http, params } = await setup(ListarUsuarios);
    http.expectOne(r => r.url.endsWith('/usuarios')).flush(Array.from({ length: 12 }, (_, id) => ({ idUsuario: id, correo: `qa${id}@example.com`, rol: 'ADMIN', estado: 'ACTIVO' })));
    params.next(convertToParamMap({ pagina: '2' }));
    expect(c.visibles()).toHaveLength(2);
    params.next(convertToParamMap({ q: 'qa11', pagina: '999' }));
    expect(c.filtrados()).toHaveLength(1);
    expect(c.pagina()).toBe(1);
    expect(http.match(() => true)).toHaveLength(0);
  });

  it('Usuarios: filtra por rol y por estado', async () => {
    const { c, http, params } = await setup(ListarUsuarios);
    http.expectOne(r => r.url.endsWith('/usuarios')).flush([
      { idUsuario: 1, correo: 'a@x.com', rol: 'ADMIN', estado: 'ACTIVO' },
      { idUsuario: 2, correo: 'b@x.com', rol: 'CLIENTE', estado: 'ACTIVO' },
      { idUsuario: 3, correo: 'c@x.com', rol: 'CLIENTE', estado: 'INACTIVO' }]);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.filtrarRol('CLIENTE');
    expect(c.filtrados().map(u => u.idUsuario)).toEqual([2, 3]);
    params.next(convertToParamMap({ estado: 'INACTIVO' }));
    expect(c.filtrados().map(u => u.idUsuario)).toEqual([3]);
  });

  it('Mis pedidos (cliente) usa el endpoint paginado propio', async () => {
    const { http } = await setup(MisPedidos, 'CLIENTE');
    http.expectOne(r => r.url.includes('/pedidos/mis-pedidos/paginado?pagina=0&tamanio=10')).flush(pagina([]));
  });

  it('Mis pedidos: Editar solo está habilitado para pedidos RECIBIDO', async () => {
    const { fixture, http } = await setup(MisPedidos, 'CLIENTE');
    http.expectOne(r => r.url.includes('/pedidos/mis-pedidos/paginado'))
      .flush(pagina([{ idPedido: 7, estado: 'RECIBIDO' }, { idPedido: 8, estado: 'EN_PREPARACION' }]));
    fixture.detectChanges();
    const enlaces = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(enlaces.filter(a => a.textContent?.includes('Editar')).map(a => a.getAttribute('href'))).toEqual(['/cliente/pedidos/7/editar']);
    expect((fixture.nativeElement.querySelector('span[title*="EN_PREPARACION"]') as HTMLElement).textContent).toContain('Editar');
  });

  it('Pedidos (ADMIN) se paginan en el servidor con los totales del backend', async () => {
    const { c, http, params } = await setup(ListarPedidos);
    http.expectOne(r => r.url.endsWith('/pedidos/paginado?pagina=0&tamanio=10'))
      .flush(pagina(Array.from({ length: 10 }, (_, id) => ({ idPedido: id, estado: 'RECIBIDO' })), { totalElementos: 23, totalPaginas: 3, ultima: false }));
    expect(c.paginadoServidor).toBe(true);
    expect(c.total()).toBe(23);
    expect(c.paginas()).toBe(3);
    // La página 2 de la UI es la página 1 del backend: se vuelve a consultar.
    params.next(convertToParamMap({ pagina: '2' }));
    http.expectOne(r => r.url.endsWith('/pedidos/paginado?pagina=1&tamanio=10'))
      .flush(pagina([{ idPedido: 99 }], { pagina: 1, totalElementos: 23, totalPaginas: 3 }));
    expect(c.pagina()).toBe(2);
    expect(c.visibles()).toHaveLength(1);
  });

  it('Pedidos: el filtro de estado se envía al backend y la búsqueda no vuelve a consultar', async () => {
    const { c, http, params } = await setup(ListarPedidos);
    http.expectOne(r => r.url.includes('/pedidos/paginado')).flush(pagina([{ idPedido: 1, razonSocial: 'Norte' }, { idPedido: 2, razonSocial: 'Sur' }]));
    params.next(convertToParamMap({ q: 'norte' }));
    expect(http.match(() => true)).toHaveLength(0);
    expect(c.visibles()).toHaveLength(1);
    params.next(convertToParamMap({ estado: 'ENTREGADO' }));
    http.expectOne(r => r.url.endsWith('/pedidos/paginado?pagina=0&tamanio=10&estado=ENTREGADO')).flush(pagina([]));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.filtrarEstado('CANCELADO');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { estado: 'CANCELADO', pagina: null } }));
  });

  it('muestra el error y permite reintentar sin recargar la aplicación', async () => {
    const { fixture, c, http } = await setup(ListarUsuarios);
    http.expectOne(r => r.url.endsWith('/usuarios')).flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No tienes permiso');
    c.actualizar();
    http.expectOne(r => r.url.endsWith('/usuarios')).flush([{ idUsuario: 9, correo: 'nuevo@example.com', rol: 'ADMIN', estado: 'ACTIVO' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('nuevo@example.com');
  });

  it('la búsqueda escribe q en la URL y reinicia la página', async () => {
    const { c, http } = await setup(ListarFallas);
    http.expectOne(r => r.url.endsWith('/fallas')).flush([]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.buscar('motor');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { q: 'motor', pagina: null }, replaceUrl: true }));
  });

  it('Conductores: avisa licencias vencidas o por vencer', async () => {
    const { c, http } = await setup(ListarConductores);
    http.expectOne(r => r.url.endsWith('/conductores/activos')).flush([]);
    const enDias = (d: number) => { const f = new Date(); f.setDate(f.getDate() + d); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
    const conductor = (fecha: string) => ({ fechaVencimientoLicencia: fecha }) as never;
    expect(c.licencia(conductor(enDias(-1))).texto).toBe('Vencida');
    expect(c.licencia(conductor(enDias(10))).texto).toBe('Vence en 10 días');
    expect(c.licencia(conductor(enDias(90))).texto).toBe('Vigente');
  });
});
