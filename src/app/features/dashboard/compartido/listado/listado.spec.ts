import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Auth } from '../../../../core/auth/auth';
import { Listado } from './listado';

describe('Listados por módulo y filtros URL', () => {
  async function setup(rol = 'ADMIN', key = 'usuarios') {
    const data = new BehaviorSubject({sectionKey: key});
    const params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({ imports: [Listado], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { data, queryParamMap: params } },
      { provide: Auth, useValue: { usuario: signal({rol}), getAccessToken: () => 'token' } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(Listado);
    return { fixture, http: TestBed.inject(HttpTestingController), data, params };
  }
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });
  it('solo consulta el módulo abierto y restaura búsqueda/página desde la URL', async () => {
    const {fixture, http, params} = await setup();
    const requests = http.match(() => true); expect(requests).toHaveLength(1);
    expect(requests[0].request.url).toContain('/usuarios');
    requests[0].flush(Array.from({length:12}, (_,id) => ({idUsuario:id, correo:`qa${id}@example.com`,rol:'ADMIN'})));
    params.next(convertToParamMap({pagina:'2'}));
    expect(fixture.componentInstance.visible()).toHaveLength(2);
    params.next(convertToParamMap({q:'qa11',pagina:'999'}));
    expect(fixture.componentInstance.filtered()).toHaveLength(1);
    expect(fixture.componentInstance.page()).toBe(1);
  });
  const pagina = (contenido: unknown[], extra: Record<string, unknown> = {}) =>
    ({ contenido, pagina: 0, tamanio: 10, totalElementos: contenido.length, totalPaginas: contenido.length ? 1 : 0, primera: true, ultima: true, ...extra });

  it('cliente usa mis-pedidos paginado y no el listado general', async () => {
    const {http} = await setup('CLIENTE','pedidos');
    http.expectOne(r => r.url.includes('/pedidos/mis-pedidos/paginado?pagina=0&tamanio=10')).flush(pagina([]));
  });
  it('en Mis pedidos, Editar solo está habilitado para pedidos RECIBIDO', async () => {
    const {fixture, http} = await setup('CLIENTE','pedidos');
    http.expectOne(r => r.url.includes('/pedidos/mis-pedidos/paginado'))
      .flush(pagina([{idPedido:7, estado:'RECIBIDO'}, {idPedido:8, estado:'EN_PREPARACION'}]));
    fixture.detectChanges();
    const editar = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(editar.filter(a => a.textContent?.includes('Editar')).map(a => a.getAttribute('href'))).toEqual(['/cliente/pedidos/7/editar']);
    const bloqueado = fixture.nativeElement.querySelector('span[title*="EN_PREPARACION"]') as HTMLElement;
    expect(bloqueado.textContent).toContain('Editar');
  });
  it('pedidos de ADMIN se paginan en el servidor con los totales del backend', async () => {
    const {fixture, http, params} = await setup('ADMIN','pedidos');
    http.expectOne(r => r.url.endsWith('/pedidos/paginado?pagina=0&tamanio=10'))
      .flush(pagina(Array.from({length:10}, (_,id) => ({idPedido:id, estado:'RECIBIDO'})), {totalElementos:23, totalPaginas:3, ultima:false}));
    const c = fixture.componentInstance;
    expect(c.paginadoServidor()).toBe(true);
    expect(c.total()).toBe(23);
    expect(c.pages()).toBe(3);
    expect(c.visible()).toHaveLength(10);
    // La página 2 de la UI es la página 1 del backend: se vuelve a consultar.
    params.next(convertToParamMap({pagina:'2'}));
    http.expectOne(r => r.url.endsWith('/pedidos/paginado?pagina=1&tamanio=10'))
      .flush(pagina([{idPedido:99}], {pagina:1, totalElementos:23, totalPaginas:3}));
    expect(c.page()).toBe(2);
    expect(c.visible()).toHaveLength(1);
  });
  it('el filtro de estado se envía al backend', async () => {
    const {fixture, http, params} = await setup('PROGRAMADOR','pedidos');
    http.expectOne(r => r.url.includes('/pedidos/paginado')).flush(pagina([]));
    params.next(convertToParamMap({estado:'ENTREGADO'}));
    http.expectOne(r => r.url.endsWith('/pedidos/paginado?pagina=0&tamanio=10&estado=ENTREGADO')).flush(pagina([]));
    const navigate = vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    fixture.componentInstance.filtrarEstado('CANCELADO');
    expect(navigate).toHaveBeenCalledWith([],expect.objectContaining({queryParams:{estado:'CANCELADO',pagina:null}}));
  });
  it('en modo servidor la búsqueda local no dispara otra consulta', async () => {
    const {fixture, http, params} = await setup('ADMIN','pedidos');
    http.expectOne(r => r.url.includes('/pedidos/paginado')).flush(pagina([{idPedido:1, razonSocial:'Norte'},{idPedido:2, razonSocial:'Sur'}]));
    params.next(convertToParamMap({q:'norte'}));
    expect(http.match(() => true)).toHaveLength(0);
    expect(fixture.componentInstance.visible()).toHaveLength(1);
  });
  it('una sección ajena no dispara consultas', async () => {
    const {fixture,http} = await setup('CONDUCTOR','usuarios');
    expect(http.match(() => true)).toHaveLength(0);
    expect(fixture.componentInstance.error()).toContain('No tienes acceso');
  });
  it('muestra error y permite reintentar sin recargar toda la aplicación', async () => {
    const {fixture,http} = await setup();
    http.expectOne(r=>r.url.endsWith('/usuarios')).flush({}, {status:403,statusText:'Forbidden'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No tienes permiso');
    fixture.componentInstance.refresh();
    http.expectOne(r=>r.url.endsWith('/usuarios')).flush([{correo:'nuevo@example.com'}]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('nuevo@example.com');
  });
  it('la búsqueda escribe q y reinicia la página, no usa seccion', async () => {
    const {fixture,http} = await setup();
    http.expectOne(r=>r.url.endsWith('/usuarios')).flush([]);
    const navigate = vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    fixture.componentInstance.filter('qa');
    expect(navigate).toHaveBeenCalledWith([],expect.objectContaining({queryParams:{q:'qa',pagina:null},replaceUrl:true}));
  });
});
