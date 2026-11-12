import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, afterEach } from 'vitest';
import { Auth } from '../../../core/auth/auth';
import { Sidebar } from './sidebar';
import { environment } from '../../../../environments/environment';

describe('Barra lateral por rol', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  async function setup(rol: string) {
    await TestBed.configureTestingModule({ imports: [Sidebar], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { usuario: signal({ rol }), getAccessToken: () => 'test-token' } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
    const path = rol === 'CLIENTE' ? 'clientes/me' : 'trabajadores/me';
    const perfil = TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/api/v1/${path}`);
    expect(perfil.request.headers.get('Authorization')).toBe('Bearer test-token');
    perfil.flush(rol === 'CLIENTE' ? { razonSocial: 'Empresa de prueba' } : { nombres: 'Persona', apellidos: 'de prueba' });
    fixture.detectChanges();
    expect(fixture.componentInstance.empresaNombre()).toBe(rol === 'CLIENTE' ? 'Empresa de prueba' : 'Persona de prueba');
    return fixture;
  }
  it('conductor tiene sus módulos y perfil con rutas independientes', async () => {
    const fixture = await setup('CONDUCTOR');
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map(link => link.textContent?.trim())).toEqual(['Resumen', 'Mis atenciones', 'Mis alertas']);
    expect(links[1].getAttribute('href')).toBe('/dashboard/atenciones');
    expect(fixture.componentInstance.profile()).toBe('/dashboard/perfil');
    const grupo = fixture.nativeElement.querySelector('button[aria-controls="submenu-atenciones"]') as HTMLButtonElement;
    expect(grupo.getAttribute('aria-expanded')).toBe('false');
    grupo.click();
    fixture.detectChanges();
    expect(grupo.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#submenu-atenciones').hidden).toBe(false);
  });
  it('programador ve sus módulos agrupados, con icono y «Listar …» en cada uno', async () => {
    const fixture = await setup('PROGRAMADOR');
    const grupos = fixture.componentInstance.sections();
    expect(grupos.map(g => g.title)).toEqual(['Pedidos', 'Atenciones', 'Alertas', 'Conductores', 'Cisternas', 'Productos']);
    expect(grupos.every(g => g.icono.startsWith('pi pi-') && g.children.length > 0)).toBe(true);
    const hijos = Object.fromEntries(grupos.map(g => [g.title, g.children.map(c => `${c.titulo} → ${c.ruta}`)]));
    expect(hijos['Conductores']).toEqual(['Listar conductores → /dashboard/conductores']);
    expect(hijos['Cisternas']).toEqual(['Listar cisternas → /dashboard/cisternas']);
    expect(hijos['Productos']).toEqual(['Listar productos → /dashboard/productos']);
    expect(hijos['Atenciones']).toEqual(['Listar atenciones → /dashboard/atenciones', 'Crear atención → /dashboard/atenciones/nueva']);
    // Módulos de otros roles no aparecen.
    expect(grupos.some(g => ['usuarios', 'clientes', 'trabajadores', 'fallas'].includes(g.key))).toBe(false);
  });
  it('admin puede buscar las secciones adicionales', async () => {
    const fixture = await setup('ADMIN');
    expect(fixture.componentInstance.sections()).toHaveLength(11);
    fixture.componentInstance.search.set('usuarios'); fixture.detectChanges();
    expect(fixture.componentInstance.sections().map(section => section.key)).toEqual(['usuarios']);
    expect(fixture.nativeElement.textContent).not.toContain('Cisternas activas');
  });
  it('cliente reutiliza el sidebar con sus siete opciones y sin módulos administrativos', async () => {
    const fixture = await setup('CLIENTE');
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map(link => link.textContent?.trim())).toEqual(['Inicio', 'Mis pedidos', 'Crear pedido', 'Editar pedido', 'Citas', 'Seguimiento', 'Productos']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/cliente/inicio', '/cliente/pedidos', '/cliente/pedidos/nuevo', '/cliente/pedidos/editar', '/cliente/citas', '/cliente/seguimiento', '/cliente/productos']);
    expect(fixture.componentInstance.profile()).toBe('/cliente/perfil');
    expect(links.some(link => link.getAttribute('href')?.startsWith('/dashboard'))).toBe(false);
  });
  it('cliente puede buscar Citas en el mismo menú', async () => {
    const fixture = await setup('CLIENTE');
    fixture.componentInstance.search.set('citas');
    fixture.detectChanges();
    expect(fixture.componentInstance.sections().map(section => section.key)).toEqual(['citas']);
  });
});
