import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

@Component({ template: '' }) class Vacia {}

describe('App', () => {
  afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll('[data-scroll-principal]').forEach(e => e.remove()); });

  async function setup() {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([
      { path: 'a', component: Vacia }, { path: 'b', component: Vacia },
    ])] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const main = document.createElement('main');
    main.setAttribute('data-scroll-principal', '');
    document.body.appendChild(main);
    const ventana = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    return { fixture, router: TestBed.inject(Router), main, ventana };
  }

  it('renders the routed application', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('al cambiar de pantalla sube la ventana y el <main> del dashboard', async () => {
    const { router, main, ventana } = await setup();
    await router.navigateByUrl('/a');
    main.scrollTop = 500; ventana.mockClear();
    await router.navigateByUrl('/b');
    expect(ventana).toHaveBeenCalledWith(0, 0);
    expect(main.scrollTop).toBe(0);
  });

  it('cambiar solo búsqueda/página (?q, ?pagina) no mueve el scroll', async () => {
    const { router, main, ventana } = await setup();
    await router.navigateByUrl('/a');
    main.scrollTop = 500; ventana.mockClear();
    await router.navigateByUrl('/a?q=norte&pagina=2');
    expect(ventana).not.toHaveBeenCalled();
    expect(main.scrollTop).toBe(500);
  });

  it('un enlace con ancla (#seccion) no fuerza subir', async () => {
    const { router, ventana } = await setup();
    await router.navigateByUrl('/a');
    ventana.mockClear();
    await router.navigateByUrl('/b#detalle');
    expect(ventana).not.toHaveBeenCalled();
  });
});
