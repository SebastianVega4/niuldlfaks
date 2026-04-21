import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container flex justify-center items-center" style="min-height: 70vh;">
      <div class="glass-panel" style="width: 100%; max-width: 400px; padding: 2.5rem;">
        <h2 class="title-glow text-center" style="margin-bottom: 2rem; font-size: 2rem;">
          {{ isSignUp() ? 'Crear Cuenta' : 'Acceso Administrador' }}
        </h2>
        
        <form (ngSubmit)="onSubmit()" class="flex" style="flex-direction: column; gap: 1.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Email</label>
            <input type="email" [(ngModel)]="email" name="email" required style="width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--bg-secondary); color: white;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Contraseña</label>
            <input type="password" [(ngModel)]="password" name="password" required style="width: 100%; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--bg-secondary); color: white;">
          </div>
          
          <div *ngIf="error()" style="color: #f43f5e; font-size: 0.9rem; text-align: center;">
             {{ error() }}
          </div>

          <div *ngIf="message()" style="color: #10b981; font-size: 0.9rem; text-align: center;">
             {{ message() }}
          </div>

          <button type="submit" class="btn btn-primary animate-pulse-glow" [disabled]="loading()" style="width: 100%; margin-top: 1rem; padding: 1rem; font-size: 1.1rem;">
            {{ loading() ? 'Procesando...' : (isSignUp() ? 'Registrarse' : 'Entrar') }}
          </button>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  supabase = inject(SupabaseService);
  email = '';
  password = '';
  loading = signal(false);
  isSignUp = signal(false);
  error = signal('');
  message = signal('');

  toggleMode() {
    this.isSignUp.update(v => !v);
    this.error.set('');
    this.message.set('');
  }

  async onSubmit() {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    try {
      if (this.isSignUp()) {
        await this.supabase.signUp(this.email, this.password);
        this.message.set('Registro exitoso. Revisa tu correo (si aplica) o intenta iniciar sesión.');
        this.isSignUp.set(false);
      } else {
        await this.supabase.signIn(this.email, this.password);
      }
    } catch (e: any) {
      this.error.set(e.message || 'Error en la operación');
    } finally {
      this.loading.set(false);
    }
  }
}
