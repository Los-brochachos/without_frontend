import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Auth } from '../auth/auth';
import { CLASE_OSCURO, PortalPreferencias } from './portal-preferencias';
import { FechaPipe } from '../pipes/fecha.pipe';

describe('Preferencias: tema y formato de fecha', () => {
  const usuario = signal<{ idUsuario: number; rol: string } | null>({ idUsuario: 7, rol: 'PROGRAMADOR' });
  function crear() {
    TestBed.configureTestingModule({ providers: [{ provide: Auth, useValue: { usuario } }] });
    const prefs = TestBed.inject(PortalPreferencias);
    TestBed.tick();
    return prefs;
  }
  beforeEach(() => { localStorage.clear(); usuario.set({ idUsuario: 7, rol: 'PROGRAMADOR' }); });
  afterEach(() => { TestBed.resetTestingModule(); document.documentElement.classList.remove(CLASE_OSCURO); });

  it('por defecto: tema claro y día/mes/año', () => {
    const prefs = crear();
    expect(prefs.tema()).toBe('claro');
    expect(prefs.formato()).toBe('dd/MM/yyyy');
    expect(document.documentElement.classList.contains(CLASE_OSCURO)).toBe(false);
  });

  it('elegir oscuro activa la clase en <html> y se guarda por cuenta', () => {
    const prefs = crear();
    prefs.guardar('yyyy-MM-dd', 'TODAS', 'oscuro');
    TestBed.tick();
    expect(document.documentElement.classList.contains(CLASE_OSCURO)).toBe(true);
    expect(JSON.parse(localStorage.getItem('without-preferencias-7')!)).toEqual({ formato: 'yyyy-MM-dd', citasEstado: 'TODAS', tema: 'oscuro' });
  });

  it('al cerrar sesión vuelve a claro (el sitio público no usa el tema de la cuenta)', () => {
    const prefs = crear();
    prefs.guardar('dd/MM/yyyy', 'TODAS', 'oscuro'); TestBed.tick();
    usuario.set(null); TestBed.tick();
    expect(document.documentElement.classList.contains(CLASE_OSCURO)).toBe(false);
  });

  it('valores inválidos guardados se ignoran', () => {
    localStorage.setItem('without-preferencias-7', JSON.stringify({ formato: 'MM-dd', tema: 'neon', citasEstado: 'X' }));
    const prefs = crear();
    expect(prefs.formato()).toBe('dd/MM/yyyy');
    expect(prefs.tema()).toBe('claro');
    expect(prefs.citasEstado()).toBe('TODAS');
  });

  it('el pipe fecha usa el formato elegido, con o sin hora', () => {
    const prefs = crear();
    const pipe = TestBed.runInInjectionContext(() => new FechaPipe());
    expect(pipe.transform('2026-11-12')).toBe('12/11/2026');
    expect(pipe.transform('2026-11-12T08:05:00', true)).toBe('12/11/2026 08:05');
    prefs.guardar('yyyy-MM-dd', 'TODAS', 'claro');
    expect(pipe.transform('2026-11-12')).toBe('2026-11-12');
    expect(pipe.transform(null)).toBeNull();
  });
});
