import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../../core/services/api.service';
import { CisternaResponse, FallaResponse } from '../../../../core/models/CisternaModel';

/** Fecha y hora local actual en el formato de <input type="datetime-local"> (yyyy-MM-ddTHH:mm). */
export function ahoraLocal(): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Mensaje legible para un error HTTP del backend. */
export function mensajeHttp(e: { status?: number; error?: { message?: string } }, defecto: string): string {
  if (e.status === 400 || e.status === 404) return e.error?.message || 'Revisa los datos ingresados.';
  if (e.status === 403) return 'Tu rol no tiene permiso para esta acción.';
  if (e.status === 0) return 'No se pudo conectar con el servidor. Intenta nuevamente.';
  return defecto;
}

/**
 * El técnico reporta una falla en una cisterna. POST /fallas (solo TECNICO).
 * El backend asigna al técnico autenticado y deja la falla en PENDIENTE.
 */
@Component({ selector: 'app-reportar-falla', imports: [ReactiveFormsModule, RouterLink, InputTextModule], templateUrl: './reportar-falla.html' })
export class ReportarFalla {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly cisternas = signal<CisternaResponse[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly maxFecha = ahoraLocal();
  readonly form = inject(FormBuilder).group({
    idCisterna: [null as number | null, Validators.required],
    fechaHora: [ahoraLocal(), Validators.required],
    descripcion: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(250)]],
  });

  constructor() {
    this.api.get<CisternaResponse[]>('cisternas/activas').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: c => { this.cisternas.set(c); this.cargando.set(false); },
      error: e => { this.error.set(mensajeHttp(e, 'No se pudieron cargar las cisternas.')); this.cargando.set(false); },
    });
  }

  invalido(campo: 'idCisterna' | 'fechaHora' | 'descripcion') { const c = this.form.controls[campo]; return c.touched && c.invalid; }

  guardar() {
    if (this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set('');
    const v = this.form.getRawValue();
    if (this.form.invalid) { this.error.set('Completa la cisterna, la fecha y la descripción (máx. 250 caracteres).'); return; }
    if (v.fechaHora! > ahoraLocal()) { this.error.set('La fecha de la falla no puede estar en el futuro.'); return; }
    this.guardando.set(true);
    this.api.post<FallaResponse>('fallas', { idCisterna: v.idCisterna, fechaHora: v.fechaHora, descripcion: v.descripcion!.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: f => void this.router.navigate(['/dashboard/fallas'], { state: { aviso: `Falla #${f.idFalla} reportada. Quedó en estado PENDIENTE.` } }),
        error: e => { this.guardando.set(false); this.error.set(mensajeHttp(e, 'No se pudo registrar la falla.')); },
      });
  }
}
