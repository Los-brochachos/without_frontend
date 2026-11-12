import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Auth } from '../../../core/auth/auth';
import { CLASE_OSCURO } from '../../../core/services/portal-preferencias';
import { OpcionesCuenta } from './opciones';

describe('Cuenta: seguridad y preferencias (cliente y personal)', () => {
  async function setup(rol: string, pagina: string) {
    await TestBed.configureTestingModule({ imports: [OpcionesCuenta], providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { data: new BehaviorSubject({ pagina }) } },
      { provide: Auth, useValue: { usuario: signal({ idUsuario: 5, rol }), getAccessToken: () => 't', logout: () => of(null), clearSession: () => {} } }] }).compileComponents();
    const fixture = TestBed.createComponent(OpcionesCuenta);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, vista: fixture.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController) };
  }
  beforeEach(() => localStorage.clear());
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); document.documentElement.classList.remove(CLASE_OSCURO); });

  it('el personal puede cambiar su contraseña (PATCH /cuenta/clave) y vuelve a su dashboard', async () => {
    const { c, http, vista } = await setup('PROGRAMADOR', 'seguridad');
    expect(vista.querySelector('a[href="/dashboard"]')).not.toBeNull();
    c.clave.setValue({ actual: 'Actual1234*', nueva: 'Nueva1234*', confirmacion: 'Nueva1234*' });
    c.cambiarClave();
    const req = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/api/v1/cuenta/clave'));
    expect(req.request.body).toEqual({ actual: 'Actual1234*', nueva: 'Nueva1234*' });
    req.flush(null);
  });

  it('el personal ve tema y formato, pero no el filtro de citas (es del cliente)', async () => {
    const { vista } = await setup('CONDUCTOR', 'preferencias');
    expect(vista.textContent).toContain('Tema de la aplicación');
    expect(vista.querySelector('#formato-fecha')).not.toBeNull();
    expect(vista.querySelector('#citas-predeterminadas')).toBeNull();
  });

  it('el cliente además ve el filtro inicial de citas', async () => {
    const { vista } = await setup('CLIENTE', 'preferencias');
    expect(vista.querySelector('#citas-predeterminadas')).not.toBeNull();
    expect(vista.querySelector('a[href="/cliente/inicio"]')).not.toBeNull();
  });

  it('guardar el tema oscuro lo aplica a toda la app', async () => {
    const { c } = await setup('ADMIN', 'preferencias');
    c.ajustes.patchValue({ tema: 'oscuro', formato: 'yyyy-MM-dd' });
    c.guardarPreferencias();
    TestBed.tick();
    expect(document.documentElement.classList.contains(CLASE_OSCURO)).toBe(true);
    expect(c.preferencias.formato()).toBe('yyyy-MM-dd');
    expect(c.mensaje()).toContain('guardadas');
  });
});
