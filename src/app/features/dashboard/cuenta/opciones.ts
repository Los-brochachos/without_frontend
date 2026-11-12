import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { catchError, of, switchMap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Auth } from '../../../core/auth/auth';
import { homeForRole } from '../../../core/auth/access';
import { PortalPreferencias, Tema } from '../../../core/services/portal-preferencias';

/**
 * Cuenta del usuario (cliente y personal):
 * - seguridad: cambiar contraseña (PATCH /cuenta/clave, cualquier usuario autenticado).
 * - preferencias: tema claro/oscuro/sistema, formato de fecha y (solo cliente) filtro inicial de citas.
 * - ayuda: preguntas frecuentes del cliente.
 */
@Component({ selector: 'app-opciones-cuenta', imports: [ReactiveFormsModule, RouterLink, InputTextModule, ButtonModule, DatePipe], templateUrl: './opciones.html' })
export class OpcionesCuenta {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly preferencias = inject(PortalPreferencias);
  readonly pagina = signal('');
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly guardando = signal(false);
  readonly hoy = new Date();
  readonly esCliente = computed(() => this.auth.usuario()?.rol === 'CLIENTE');
  /** «Volver al inicio» según el área del usuario. */
  readonly inicio = computed(() => homeForRole(this.auth.usuario()?.rol));
  readonly temas: { valor: Tema; etiqueta: string; descripcion: string; icono: string; muestra: string; tarjeta: string }[] = [
    { valor: 'claro', etiqueta: 'Claro', descripcion: 'Fondo claro (predeterminado).', icono: 'pi pi-sun', muestra: 'bg-[#e9eef5]', tarjeta: 'bg-[#ffffff]' },
    { valor: 'oscuro', etiqueta: 'Oscuro', descripcion: 'Reduce el brillo de la pantalla.', icono: 'pi pi-moon', muestra: 'bg-[#0b1220]', tarjeta: 'bg-[#16223a]' },
    { valor: 'sistema', etiqueta: 'Según el sistema', descripcion: 'Sigue el modo de tu dispositivo.', icono: 'pi pi-desktop', muestra: 'bg-linear-to-r from-[#e9eef5] to-[#0b1220]', tarjeta: 'bg-[#8a9ab0]' },
  ];
  readonly clave = this.fb.nonNullable.group({ actual: ['', Validators.required], nueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72), Validators.pattern(/\S/)]], confirmacion: ['', Validators.required] }, { validators: (c: AbstractControl) => c.get('nueva')?.value === c.get('confirmacion')?.value ? null : { distintas: true } });
  readonly ajustes = this.fb.nonNullable.group({ formato: ['dd/MM/yyyy'], citasEstado: ['TODAS'], tema: ['claro' as Tema] });
  constructor() {
    effect(() => {
      const formato = this.preferencias.formato(); const citasEstado = this.preferencias.citasEstado(); const tema = this.preferencias.tema();
      if (!this.ajustes.dirty) this.ajustes.patchValue({ formato, citasEstado, tema });
    });
    inject(ActivatedRoute).data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.pagina.set(data['pagina']); this.error.set(''); this.mensaje.set(''); this.clave.reset();
      this.ajustes.setValue({ formato: this.preferencias.formato(), citasEstado: this.preferencias.citasEstado(), tema: this.preferencias.tema() }); this.ajustes.markAsPristine();
    });
  }
  guardarPreferencias() {
    const v = this.ajustes.getRawValue();
    try {
      this.preferencias.guardar(v.formato, v.citasEstado, v.tema);
      this.ajustes.markAsPristine();
      this.mensaje.set('Preferencias guardadas en este navegador.'); this.error.set('');
    } catch { this.error.set('Este navegador no permite guardar preferencias.'); }
  }
  cambiarClave() {
    if (this.guardando()) return;
    this.clave.markAllAsTouched(); this.error.set('');
    if (this.clave.invalid) { this.error.set('Completa la contraseña actual y confirma una nueva de entre 8 y 72 caracteres.'); return; }
    const { actual, nueva } = this.clave.getRawValue();
    if (new TextEncoder().encode(nueva).length > 72) { this.error.set('La nueva contraseña supera la longitud admitida. Reduce su tamaño.'); return; }
    this.guardando.set(true);
    this.api.patch<void>('cuenta/clave', { actual, nueva }).pipe(
      switchMap(() => this.auth.logout().pipe(catchError(() => of(null)))), takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: () => { this.auth.clearSession(); this.clave.reset(); void this.router.navigate(['/login'], { state: { claveActualizada: true } }); }, error: e => { this.guardando.set(false); this.error.set(e.status === 400 ? (e.error?.message || 'Revisa los datos ingresados.') : 'No se pudo confirmar el cambio de contraseña.'); } });
  }
}
