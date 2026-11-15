import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { UsuarioResponse } from '../../../../core/models/UsuarioModel';
import { SUPERADMIN, tieneRol } from '../../../../core/auth/access';
import { Alertas } from '../../../../core/ui/alerta-modal/alertas';
import { FuenteListado, ListadoBase } from '../../compartido/listado/listado-base';
import { Paginacion } from '../../compartido/listado/paginacion';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cuentas de acceso del sistema (ADMIN, ANALISTA y SUPERADMIN). GET /usuarios.
 * Solo el SUPERADMIN puede hacer un cambio de correo de EMERGENCIA de otra cuenta (PATCH /usuarios/{id}):
 * el backend cierra las sesiones de esa cuenta, que deberá ingresar con el correo nuevo.
 */
@Component({ selector: 'app-listar-usuarios', imports: [RouterLink, InputTextModule, DialogModule, Paginacion], templateUrl: './listar-usuarios.html' })
export class ListarUsuarios extends ListadoBase<UsuarioResponse> {
  readonly roles = ['SUPERADMIN', 'ADMIN', 'ANALISTA', 'PROGRAMADOR', 'CONDUCTOR', 'TECNICO', 'CLIENTE'];
  readonly estados = ['ACTIVO', 'INACTIVO'];
  readonly rol = signal('');
  readonly esSuperadmin = this.rolActual === SUPERADMIN;
  /** ADMIN y SUPERADMIN activan / desactivan cuentas (DELETE /usuarios/{id}, PATCH /usuarios/{id}/activar). */
  readonly puedeGestionar = tieneRol(this.rolActual, 'ADMIN');
  /** Nadie se desactiva a sí mismo (también lo impide el backend). */
  readonly correoPropio = this.auth.usuario()?.correo ?? '';
  /** Cuenta cuyo estado se está cambiando. */
  readonly procesando = signal<number | null>(null);
  private readonly alertas = inject(Alertas);

  async cambiarEstado(u: UsuarioResponse) {
    if (this.procesando() !== null) return;
    const desactivar = u.estado === 'ACTIVO';
    const ok = await this.alertas.mostrar(desactivar
      ? { titulo: '¿Desactivar la cuenta?', tipo: 'advertencia', textoAceptar: 'Sí, desactivar', textoCancelar: 'Cancelar',
          mensaje: `${u.correo} (${u.rol}) no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus datos se conservan y puedes reactivarla después.` }
      : { titulo: '¿Activar la cuenta?', tipo: 'info', textoAceptar: 'Sí, activar', textoCancelar: 'Cancelar',
          mensaje: `${u.correo} (${u.rol}) podrá volver a iniciar sesión.` });
    if (!ok) return;
    this.procesando.set(u.idUsuario); this.aviso.set('');
    const peticion = desactivar ? this.api.delete<void>(`usuarios/${u.idUsuario}`) : this.api.patch<void>(`usuarios/${u.idUsuario}/activar`, {});
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.procesando.set(null); this.aviso.set(`Cuenta ${u.correo} ${desactivar ? 'desactivada' : 'activada'}.`); this.actualizar(); },
      error: e => {
        this.procesando.set(null);
        void this.alertas.mostrar({ titulo: 'No se pudo cambiar el estado', tipo: 'error',
          mensaje: e.status === 400 ? (e.error?.message || 'Revisa la cuenta seleccionada.') : e.status === 403 ? 'Tu rol no tiene permiso para esta acción.' : 'No se pudo completar la operación. Actualiza el listado e inténtalo de nuevo.' });
      },
    });
  }
  /** Cuenta cuyo correo se está cambiando (diálogo abierto). */
  readonly editandoCorreo = signal<UsuarioResponse | null>(null);
  readonly nuevoCorreo = signal('');
  readonly guardandoCorreo = signal(false);
  readonly errorCorreo = signal('');

  protected fuente(): FuenteListado { return { path: 'usuarios' }; }
  protected coincide(u: UsuarioResponse, texto: string): boolean {
    return [String(u.idUsuario), u.correo].some(v => (v ?? '').toLocaleLowerCase().includes(texto));
  }
  protected override filtroExtra(u: UsuarioResponse): boolean { return !this.rol() || u.rol === this.rol(); }
  filtrarRol(rol: string) { this.rol.set(rol); this.cambiarPagina(1); }
  claseRol(rol: string): string {
    return rol === 'SUPERADMIN' ? 'bg-amber-100 text-amber-800' : rol === 'CLIENTE' ? 'bg-violet-50 text-violet-700' : rol === 'ADMIN' ? 'bg-[#002d54] text-white' : 'bg-sky-50 text-[#0077cc]';
  }

  abrirCambioCorreo(u: UsuarioResponse) { this.editandoCorreo.set(u); this.nuevoCorreo.set(''); this.errorCorreo.set(''); }
  cerrarCambioCorreo() { if (!this.guardandoCorreo()) this.editandoCorreo.set(null); }

  guardarCorreo() {
    const u = this.editandoCorreo();
    if (!u || this.guardandoCorreo()) return;
    const correo = this.nuevoCorreo().trim().toLowerCase();
    if (!CORREO_VALIDO.test(correo) || correo.length > 100) { this.errorCorreo.set('Ingresa un correo válido (máx. 100 caracteres).'); return; }
    if (correo === u.correo.toLowerCase()) { this.errorCorreo.set('El nuevo correo debe ser diferente del actual.'); return; }
    this.guardandoCorreo.set(true); this.errorCorreo.set('');
    this.api.patch<UsuarioResponse>(`usuarios/${u.idUsuario}`, { correo }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardandoCorreo.set(false); this.editandoCorreo.set(null);
        this.aviso.set(`Correo de la cuenta #${u.idUsuario} cambiado a ${correo}. Sus sesiones se cerraron: deberá ingresar con el correo nuevo.`);
        this.actualizar();
      },
      error: e => {
        this.guardandoCorreo.set(false);
        this.errorCorreo.set(e.status === 400 ? (e.error?.message || 'Revisa el correo ingresado.') : e.status === 403 ? 'Solo el superadministrador puede hacer este cambio.' : 'No se pudo cambiar el correo.');
      },
    });
  }
}
