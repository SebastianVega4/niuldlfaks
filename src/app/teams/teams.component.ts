import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Team, Player } from '../core/services/supabase.service';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container pb-8">
      <div class="glass-panel text-center" style="padding: 2rem; margin-bottom: 2rem;">
        <h1 class="title-glow" style="font-size: 2.5rem; margin-bottom: 0.5rem;">Equipos Formados</h1>
        <p style="color: var(--text-secondary);">Consulta la lista de equipos y sus integrantes tras el sorteo.</p>
      </div>

      <div *ngIf="loading()" class="text-center" style="padding: 3rem;">
        <span style="font-size: 1.5rem; color: var(--text-secondary);">Cargando equipos...</span>
      </div>

      <div *ngIf="!loading() && teams().length === 0" class="glass-panel text-center" style="padding: 3rem;">
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Aún no se han generado equipos para el torneo.</p>
        <a *ngIf="supabase.isAdmin()" routerLink="/sorteo" class="btn btn-primary">Ir al Sorteo</a>
      </div>

      <div class="grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
        <div *ngFor="let team of teams()" class="glass-panel" style="padding: 1.5rem; border-top: 4px solid var(--accent-primary);">
          <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
             <div *ngIf="editingTeamId() !== team.id; else editField" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.5rem; color: white; margin: 0;">{{ team.name }}</h3>
                <button *ngIf="supabase.isAdmin()" (click)="startEditing(team)" class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✎</button>
             </div>
             
             <ng-template #editField>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                   <input type="text" [(ngModel)]="newTeamName" class="input-field" style="flex: 1; padding: 0.3rem;">
                   <button (click)="saveTeamName(team.id!)" class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✓</button>
                   <button (click)="cancelEditing()" class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">✕</button>
                </div>
             </ng-template>

             <span style="font-size: 0.8rem; color: var(--text-secondary);">{{ getPlayersInTeam(team.id!).length }} Jugadores</span>
          </div>

          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem;">
             <li *ngFor="let player of getPlayersInTeam(team.id!)" 
                 class="flex items-center gap-3" 
                 [style.color]="player.is_leader ? 'var(--accent-primary)' : 'var(--text-primary)'">
                <svg *ngIf="player.is_leader" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <svg *ngIf="!player.is_leader" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span [style.fontWeight]="player.is_leader ? '700' : '400'">{{ player.name }}</span>
                <span *ngIf="player.is_leader" style="font-size: 0.7rem; background: rgba(59, 130, 246, 0.2); padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: auto;">LÍDER</span>
             </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .grid {
       animation: fadeIn 0.5s ease-out;
    }
    @keyframes fadeIn {
       from { opacity: 0; transform: translateY(10px); }
       to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class TeamsComponent implements OnInit {
  supabase = inject(SupabaseService);
  loading = signal(true);
  
  editingTeamId = signal<string | null>(null);
  newTeamName = '';

  teams = this.supabase.teams;
  players = this.supabase.players;

  async ngOnInit() {
    await this.supabase.fetchInitialData();
    this.loading.set(false);
  }

  getPlayersInTeam(teamId: string): Player[] {
    return this.players().filter(p => p.team_id === teamId);
  }

  startEditing(team: Team) {
    this.editingTeamId.set(team.id!);
    this.newTeamName = team.name;
  }

  cancelEditing() {
    this.editingTeamId.set(null);
    this.newTeamName = '';
  }

  async saveTeamName(teamId: string) {
    if (!this.newTeamName.trim()) return;
    try {
      await this.supabase.updateTeamName(teamId, this.newTeamName);
      this.editingTeamId.set(null);
    } catch (err) {
      alert('Error al actualizar el nombre del equipo');
    }
  }
}
