import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Match } from '../core/services/supabase.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container pb-8">
       <!-- Hero Banner -->
       <div class="glass-panel text-center" style="padding: 4rem 2rem; margin-bottom: 3rem; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);">
          <h1 class="title-glow" style="font-size: 3.5rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px;">Torneo Volley 2026</h1>
          <p style="font-size: 1.2rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto;">Sigue los marcadores en tiempo real, las estadísticas de tus equipos favoritos y descubre quién será el campeón.</p>
       </div>

       <!-- Seccion Partidos -->
       <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <h2 class="title-glow" style="font-size: 2rem; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
             Partidos
          </h2>

          <div class="glass-panel" style="padding: 0.5rem; display: flex; gap: 0.5rem; background: rgba(255,255,255,0.05);">
             <button (click)="filterStatus.set('all')" [class.active-filter]="filterStatus() === 'all'" class="filter-btn">Todos</button>
             <button (click)="filterStatus.set('live')" [class.active-filter]="filterStatus() === 'live'" class="filter-btn">En Vivo</button>
             <button (click)="filterStatus.set('finished')" [class.active-filter]="filterStatus() === 'finished'" class="filter-btn">Finalizados</button>
             <button (click)="filterStatus.set('scheduled')" [class.active-filter]="filterStatus() === 'scheduled'" class="filter-btn">Programados</button>
          </div>
       </div>

       <div *ngIf="loading()" class="text-center" style="padding: 3rem;">
           <span style="font-size: 1.5rem; color: var(--text-secondary);">Cargando encuentros...</span>
       </div>

       <div *ngIf="!loading() && filteredMatches().length === 0" class="glass-panel text-center" style="padding: 2rem;">
           <span style="color: var(--text-secondary);">No hay partidos que coincidan con el filtro.</span>
       </div>

       <div class="grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
          <div *ngFor="let m of filteredMatches()" class="glass-panel match-card" style="padding: 1.5rem; transition: transform 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <!-- Status Pill -->
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span *ngIf="m.status === 'live'" class="animate-pulse-glow" style="background-color: #ef4444; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">● EN VIVO</span>
                    <span *ngIf="m.status === 'timeout'" style="background-color: #f59e0b; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">PAUSA</span>
                    <span *ngIf="m.status === 'scheduled'" style="background-color: #64748b; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">PROGRAMADO</span>
                    <span *ngIf="m.status === 'finished'" style="background-color: #10b981; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">FINALIZADO</span>
                    
                    <span *ngIf="m.status === 'finished'" style="font-size: 0.8rem; color: #fbbf24; font-weight: bold;">⏱️ {{ formatDuration(m.game_time) }}</span>
                  </div>

                  <!-- Date Display/Edit -->
                  <div *ngIf="m.status === 'scheduled'" style="text-align: right;">
                    <div *ngIf="editingMatchId() !== m.id; else editDate" style="display: flex; align-items: center; gap: 0.5rem;">
                       <span style="font-size: 0.8rem; color: var(--text-secondary);">{{ m.scheduled_at | date:'short' }}</span>
                       <button *ngIf="supabase.isAdmin()" (click)="startEditingDate(m)" class="btn btn-secondary" style="padding: 0.1rem 0.3rem; font-size: 0.7rem;">📅</button>
                    </div>
                    <ng-template #editDate>
                       <div style="display: flex; gap: 0.3rem;">
                          <input type="datetime-local" [(ngModel)]="newMatchDate" style="font-size: 0.7rem; background: var(--bg-primary); color: white; border: 1px solid var(--border-color); padding: 0.1rem;">
                          <button (click)="saveMatchDate(m.id!)" class="btn btn-primary" style="padding: 0.1rem 0.3rem; font-size: 0.7rem;">✓</button>
                          <button (click)="editingMatchId.set(null)" class="btn btn-danger" style="padding: 0.1rem 0.3rem; font-size: 0.7rem;">✕</button>
                       </div>
                    </ng-template>
                  </div>
              </div>

              <!-- Match Teams -->
              <div class="flex justify-between items-center" style="margin-bottom: 1.5rem; text-align: center;">
                 <div style="width: 42%; padding: 0.5rem; border-radius: 8px;" 
                      [style.border]="m.status === 'finished' && m.score_sets[0] > m.score_sets[1] ? '2px solid #10b981' : '2px solid transparent'"
                      [style.background]="m.status === 'finished' && m.score_sets[0] > m.score_sets[1] ? 'rgba(16, 185, 129, 0.1)' : 'transparent'">
                    <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.2rem;">{{ getTeamName(m.team_a_id) }}</div>
                    <!-- Puntos si está en vivo, Sets si ha finalizado -->
                    <div *ngIf="m.status === 'live' || m.status === 'timeout'" style="font-size: 1.5rem; font-weight: 800; color: #3b82f6;">{{ m.current_set_score[0] }}</div>
                    <div *ngIf="m.status === 'finished'" style="font-size: 1.5rem; font-weight: 800; color: #3b82f6;">{{ m.score_sets[0] }}</div>
                 </div>
                 
                 <div style="font-weight: 800; font-size: 1.2rem; color: var(--text-secondary); margin-top: 1rem;">VS</div>
                 
                 <div style="width: 42%; padding: 0.5rem; border-radius: 8px;"
                      [style.border]="m.status === 'finished' && m.score_sets[1] > m.score_sets[0] ? '2px solid #10b981' : '2px solid transparent'"
                      [style.background]="m.status === 'finished' && m.score_sets[1] > m.score_sets[0] ? 'rgba(16, 185, 129, 0.1)' : 'transparent'">
                    <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.2rem;">{{ getTeamName(m.team_b_id) }}</div>
                    <!-- Puntos si está en vivo, Sets si ha finalizado -->
                    <div *ngIf="m.status === 'live' || m.status === 'timeout'" style="font-size: 1.5rem; font-weight: 800; color: #f43f5e;">{{ m.current_set_score[1] }}</div>
                    <div *ngIf="m.status === 'finished'" style="font-size: 1.5rem; font-weight: 800; color: #f43f5e;">{{ m.score_sets[1] }}</div>
                 </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-4">
                 <a [routerLink]="['/live', m.id]" class="btn btn-primary" style="flex: 1; text-decoration: none;">Ver Pantalla Puntos</a>
                 <!-- Solamente sale panel admin si eres administrador -->
                 <a *ngIf="supabase.isAdmin()" [routerLink]="['/admin', m.id]" class="btn btn-secondary" style="text-decoration: none;">Arbitrar</a>
              </div>
          </div>
       </div>
    </div>
  `,
  styles: [`
    .match-card:hover {
       transform: translateY(-5px);
       border-color: var(--accent-primary);
    }
    .filter-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    .filter-btn.active-filter {
      background: var(--accent-primary);
      color: white;
      font-weight: bold;
    }
  `]
})
export class HomeComponent implements OnInit {
  supabase = inject(SupabaseService);
  allMatches = signal<Match[]>([]);
  filterStatus = signal<string>('all');
  loading = signal(true);

  filteredMatches = computed(() => {
    const matches = this.allMatches();
    const filter = this.filterStatus();

    let filtered = matches;
    if (filter === 'live') {
      filtered = matches.filter(m => m.status === 'live' || m.status === 'timeout');
    } else if (filter === 'finished') {
      filtered = matches.filter(m => m.status === 'finished');
    } else if (filter === 'scheduled') {
      filtered = matches.filter(m => m.status === 'scheduled');
    }

    return [...filtered].sort((a, b) => {
      const priority: any = { 'live': 0, 'timeout': 0, 'finished': 1, 'scheduled': 2 };
      
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }

      // If both are scheduled, sort by date ascending (soonest first)
      if (a.status === 'scheduled') {
        const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
        const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
        return dateA - dateB;
      }

      // If both are finished, sort by finished_at descending (most recent first)
      if (a.status === 'finished') {
        const dateA = a.finished_at ? new Date(a.finished_at).getTime() : 0;
        const dateB = b.finished_at ? new Date(b.finished_at).getTime() : 0;
        return dateB - dateA;
      }

      // Default fallback
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  });

  editingMatchId = signal<string | null>(null);
  newMatchDate = '';

  async ngOnInit() {
     this.fetchMatches();
  }

  async fetchMatches() {
    this.loading.set(true);
    await this.supabase.fetchInitialData();
    const { data } = await this.supabase.client.from('matches').select('*');
    if (data) {
      this.allMatches.set(data as Match[]);
    }
    this.loading.set(false);
  }

  getTeamName(id: string): string {
     const t = this.supabase.teams().find(x => x.id === id);
     return t ? t.name : 'Desconocido';
  }

  formatDuration(ms: number | undefined): string {
    if (!ms) return '00:00';
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  startEditingDate(match: Match) {
    this.editingMatchId.set(match.id!);
    this.newMatchDate = match.scheduled_at ? new Date(match.scheduled_at).toISOString().slice(0, 16) : '';
  }

  async saveMatchDate(id: string) {
    await this.supabase.updateMatchState(id, { scheduled_at: this.newMatchDate });
    this.editingMatchId.set(null);
    this.fetchMatches();
  }
}
