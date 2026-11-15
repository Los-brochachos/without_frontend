import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { CisternaService } from '../../../../core/services/cisterna/cisterna-service';

/** Validaciones iguales a CisternaRequest del backend (placa ≤ 20, nombre ≤ 100, capacidad > 0 con 5 enteros y 2 decimales). */
export const VALIDACION_CISTERNA = {
  placa: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(20)],
  nombre: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
  capacidad: [Validators.required, Validators.min(0.01), Validators.max(99999.99), Validators.pattern(/^\d{1,5}(\.\d{1,2})?$/)],
};

/** ADMIN · Cisternas · Crear cisterna. POST /cisternas (queda ACTIVA). Placa y nombre repetidos los rechaza el backend (400). */
@Component({ selector: 'app-crear-cisterna', imports: [ReactiveFormsModule, RouterLink, InputTextModule], templateUrl: './crear-cisterna.html' })
export class CrearCisterna {
  private readonly service = inject(CisternaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    placa: ['', VALIDACION_CISTERNA.placa],
    nombre: ['', VALIDACION_CISTERNA.nombre],
    capacidad: [null as number | null, VALIDACION_CISTERNA.capacidad],
  });

  invalido(campo: 'placa' | 'nombre' | 'capacidad') { const c = this.form.controls[campo]; return c.touched && c.invalid; }

  guardar() {
    if (this.guardando()) return;
    this.form.markAllAsTouched(); this.error.set('');
    if (this.form.invalid) { this.error.set('Revisa los campos marcados.'); return; }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.service.crear({ placa: v.placa.trim().toUpperCase(), nombre: v.nombre.trim(), capacidad: Number(v.capacidad) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: c => void this.router.navigate(['/dashboard/cisternas'], { state: { aviso: `Cisterna #${c.idCisterna} «${c.nombre}» registrada y activa.` } }),
        error: (e: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(e.status === 400 ? (e.error?.message || 'Revisa los datos de la cisterna.') : e.status === 403 ? 'Solo el administrador puede registrar cisternas.' : 'No se pudo registrar la cisterna.');
        },
      });
  }
}
