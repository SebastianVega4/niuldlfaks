import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Match } from '../core/services/supabase.service';
import { PredictionService, LocalVote, VotePercentages } from '../core/services/prediction.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container pb-8">
       <!-- Hero Banner -->
       <div class="glass-panel text-center hero-banner" style="margin-bottom: 3rem; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);">
          <h1 class="title-glow hero-title">Torneo ASTROVOLLEY 2026-1</h1>
          <p class="hero-sub">Sigue los marcadores en tiempo real, las estadísticas de tus equipos favoritos y descubre quién será el campeón.</p>
       </div>

       <!-- Seccion Partidos -->
       <div class="matches-header">
          <h2 class="title-glow matches-title">
             <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
             Partidos
          </h2>

          <div class="glass-panel filter-bar">
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

       <div class="matches-grid">
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
                       <span style="font-size: 0.85rem; color: #fbbf24; font-weight: 700; background: rgba(251, 191, 36, 0.1); padding: 0.2rem 0.6rem; border-radius: 6px;">
                         📅 {{ m.scheduled_at | date:'MMM d, h:mm a' }}
                       </span>
                       <button *ngIf="supabase.isAdmin()" (click)="startEditingDate(m)" class="btn btn-secondary" style="padding: 0.2rem 0.4rem; font-size: 0.75rem;">✏️</button>
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
                    <div class="team-name">{{ getTeamName(m.team_a_id) }}</div>
                    <div *ngIf="m.status === 'live' || m.status === 'timeout'" style="font-size: 1.5rem; font-weight: 800; color: #3b82f6;">{{ m.current_set_score[0] }}</div>
                    <div *ngIf="m.status === 'finished'" style="font-size: 1.5rem; font-weight: 800; color: #3b82f6;">{{ m.score_sets[0] }}</div>
                 </div>

                 <div style="font-weight: 800; font-size: 1.2rem; color: var(--text-secondary); margin-top: 1rem;">VS</div>

                 <div style="width: 42%; padding: 0.5rem; border-radius: 8px;"
                      [style.border]="m.status === 'finished' && m.score_sets[1] > m.score_sets[0] ? '2px solid #10b981' : '2px solid transparent'"
                      [style.background]="m.status === 'finished' && m.score_sets[1] > m.score_sets[0] ? 'rgba(16, 185, 129, 0.1)' : 'transparent'">
                    <div class="team-name">{{ getTeamName(m.team_b_id) }}</div>
                    <div *ngIf="m.status === 'live' || m.status === 'timeout'" style="font-size: 1.5rem; font-weight: 800; color: #f43f5e;">{{ m.current_set_score[1] }}</div>
                    <div *ngIf="m.status === 'finished'" style="font-size: 1.5rem; font-weight: 800; color: #f43f5e;">{{ m.score_sets[1] }}</div>
                 </div>
              </div>

              <!-- ── Predicciones ── -->
              <div class="pred-area">

                <!-- No votó + partido programado → botones de ganador -->
                <ng-container *ngIf="!votedState()[m.id!] && m.status === 'scheduled'">
                  <p class="pred-question">¿Quién crees que gana?</p>
                  <div class="pred-vote-row">
                    <button class="pred-vote-btn pred-vote-btn--a" (click)="startVote(m, 'A')">
                      {{ getTeamName(m.team_a_id) }}
                    </button>
                    <button class="pred-vote-btn pred-vote-btn--b" (click)="startVote(m, 'B')">
                      {{ getTeamName(m.team_b_id) }}
                    </button>
                  </div>
                  <div *ngIf="pendingVote()?.matchId === m.id" class="pred-name-row animate-fade-in">
                    <input type="text" [(ngModel)]="tempUsername"
                           placeholder="Tu nombre para el ranking"
                           maxlength="20"
                           class="pred-name-input"
                           [class.pred-name-input--error]="nameError()"
                           (keydown.enter)="confirmVote(m)">
                    <button (click)="confirmVote(m)" class="btn btn-primary btn-sm" [disabled]="checkingName()">
                      {{ checkingName() ? '...' : '✓' }}
                    </button>
                    <button (click)="cancelPendingVote()" class="btn btn-secondary btn-sm">✕</button>
                  </div>
                  <div *ngIf="pendingVote()?.matchId === m.id && nameError()" class="pred-name-error">
                    ⚠ {{ nameError() }}
                  </div>
                </ng-container>

                <!-- No votó + partido en curso → bloqueado -->
                <div *ngIf="!votedState()[m.id!] && (m.status === 'live' || m.status === 'timeout')" class="pred-locked">
                  🔒 Predicciones cerradas
                </div>

                <!-- Ya votó → barras + sets + O/U siempre visibles -->
                <ng-container *ngIf="votedState()[m.id!] as vote">

                  <!-- Fila: ganador elegido + botón cambiar -->
                  <div class="pred-winner-row">
                    <span class="pred-voted-badge">✓ Ganador: <strong>{{ getTeamName(vote.winnerId) }}</strong></span>
                    <button *ngIf="m.status === 'scheduled'" (click)="clearVote(m)" class="pred-change-btn">
                      Cambiar
                    </button>
                  </div>

                  <!-- Barras de porcentaje -->
                  <div *ngIf="percentages()[m.id!] as pct" class="pred-pct-area">
                    <div class="pred-pct-row">
                      <span class="pred-pct-team" [class.pred-pct-team--voted]="vote.winnerId === m.team_a_id">
                        {{ getTeamName(m.team_a_id) }}
                      </span>
                      <div class="pred-pct-track">
                        <div class="pred-pct-fill pred-pct-fill--a" [style.width.%]="getPct(pct.aCount, pct.total)"></div>
                      </div>
                      <span class="pred-pct-val">{{ getPct(pct.aCount, pct.total) }}%</span>
                    </div>
                    <div class="pred-pct-row">
                      <span class="pred-pct-team" [class.pred-pct-team--voted]="vote.winnerId === m.team_b_id">
                        {{ getTeamName(m.team_b_id) }}
                      </span>
                      <div class="pred-pct-track">
                        <div class="pred-pct-fill pred-pct-fill--b" [style.width.%]="getPct(pct.bCount, pct.total)"></div>
                      </div>
                      <span class="pred-pct-val">{{ getPct(pct.bCount, pct.total) }}%</span>
                    </div>
                    <span class="pred-pct-total-label">{{ pct.total }} {{ pct.total === 1 ? 'predicción' : 'predicciones' }}</span>
                  </div>

                  <!-- Predicción 2: Sets -->
                  <div class="pred-bonus-section">
                    <span class="pred-bonus-label">
                      Sets del ganador
                      <span class="pred-bonus-pts">+2 pts</span>
                    </span>
                    <div class="pred-opts">
                      <button *ngFor="let opt of getSetsOptions(m)"
                              class="pred-opt"
                              [class.pred-opt--selected]="vote.setsVote === opt"
                              [disabled]="m.status !== 'scheduled'"
                              (click)="setSetsVote(m.id!, opt)">
                        {{ opt }}
                      </button>
                      <span *ngIf="!vote.setsVote && m.status === 'scheduled'" class="pred-hint">← elige</span>
                    </div>
                  </div>

                  <!-- Predicción 3: Over/Under -->
                  <div class="pred-bonus-section">
                    <span class="pred-bonus-label">
                      Over / Under <span style="font-weight:400; opacity:0.7;">{{ getOULine(m) }} pts</span>
                      <span class="pred-bonus-pts">+1 pt</span>
                    </span>
                    <div class="pred-opts">
                      <button class="pred-opt pred-opt--over"
                              [class.pred-opt--selected]="vote.ouVote === 'over'"
                              [disabled]="m.status !== 'scheduled'"
                              (click)="setOUVote(m.id!, 'over')">
                        Over ↑
                      </button>
                      <button class="pred-opt pred-opt--under"
                              [class.pred-opt--selected]="vote.ouVote === 'under'"
                              [disabled]="m.status !== 'scheduled'"
                              (click)="setOUVote(m.id!, 'under')">
                        Under ↓
                      </button>
                      <span *ngIf="!vote.ouVote && m.status === 'scheduled'" class="pred-hint">← elige</span>
                    </div>
                  </div>

                </ng-container>

              </div>
              <!-- ── / Predicciones ── -->

              <!-- Actions -->
              <div class="flex gap-4">
                 <a [routerLink]="['/live', m.id]" class="btn btn-primary" style="flex: 1; text-decoration: none;">Ver Pantalla Puntos</a>
                 <a *ngIf="supabase.isAdmin()" [routerLink]="['/admin', m.id]" class="btn btn-secondary" style="text-decoration: none;">Arbitrar</a>
              </div>
          </div>
       </div>
    </div>
  `,
  styles: [`
    .hero-banner {
      padding: 4rem 2rem;
    }
    .hero-title {
      font-size: 3.5rem;
      margin-bottom: 1rem;
      letter-spacing: 1px;
    }
    .hero-sub {
      font-size: 1.2rem;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto;
    }
    .matches-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .matches-title {
      font-size: 2rem;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .filter-bar {
      padding: 0.5rem;
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      background: rgba(255,255,255,0.05);
    }
    .matches-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: 1.5rem;
    }
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
    @media (max-width: 600px) {
      .hero-banner { padding: 2rem 1.25rem; }
      .hero-title { font-size: 2rem; }
      .hero-sub { font-size: 1rem; }
      .matches-title { font-size: 1.5rem; }
      .matches-header { flex-direction: column; align-items: flex-start; }
      .filter-bar { width: 100%; justify-content: center; }
    }
    @media (max-width: 380px) {
      .hero-title { font-size: 1.6rem; letter-spacing: 0; }
      .filter-btn { padding: 0.35rem 0.6rem; font-size: 0.8rem; }
    }

    /* ── Team name — altura fija para que todas las cards sean iguales ── */
    .team-name {
      font-weight: bold;
      font-size: 1.1rem;
      min-height: 2.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      word-break: break-word;
      overflow-wrap: break-word;
      line-height: 1.3;
      text-align: center;
    }

    /* ── Prediction area ── */
    .pred-area {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }
    .pred-question {
      font-size: 0.72rem;
      color: var(--text-secondary);
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.6rem;
    }
    .pred-vote-row {
      display: flex;
      gap: 0.6rem;
    }
    .pred-vote-btn {
      flex: 1;
      padding: 0.55rem 0.4rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      border: 1px solid;
      transition: all 0.18s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
    }
    .pred-vote-btn--a {
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.3);
      color: #3b82f6;
    }
    .pred-vote-btn--a:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
      transform: translateY(-1px);
    }
    .pred-vote-btn--b {
      background: rgba(244, 63, 94, 0.08);
      border-color: rgba(244, 63, 94, 0.3);
      color: #f43f5e;
    }
    .pred-vote-btn--b:hover {
      background: rgba(244, 63, 94, 0.2);
      border-color: #f43f5e;
      transform: translateY(-1px);
    }
    .pred-name-row {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.6rem;
      align-items: center;
    }
    .pred-name-input {
      flex: 1;
      padding: 0.4rem 0.6rem;
      background: var(--bg-primary);
      border: 1px solid var(--accent-primary);
      color: white;
      border-radius: 6px;
      font-size: 0.82rem;
      font-family: inherit;
    }
    .btn-sm {
      padding: 0.35rem 0.55rem !important;
      font-size: 0.8rem !important;
      min-width: unset !important;
    }
    .pred-name-input--error {
      border-color: #ef4444 !important;
    }
    .pred-name-error {
      font-size: 0.75rem;
      color: #ef4444;
      margin-top: 0.3rem;
      text-align: center;
    }
    .pred-locked {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-align: center;
      padding: 0.3rem 0;
      opacity: 0.7;
    }
    .pred-winner-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .pred-voted-badge {
      font-size: 0.82rem;
      color: #10b981;
      font-weight: 600;
    }
    .pred-change-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      color: var(--text-secondary);
      font-size: 0.72rem;
      padding: 0.2rem 0.55rem;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.18s;
    }
    .pred-change-btn:hover {
      border-color: rgba(255,255,255,0.35);
      color: var(--text-primary);
    }

    /* Bonus sections (sets y O/U) */
    .pred-bonus-section {
      margin-top: 0.65rem;
      padding-top: 0.55rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .pred-bonus-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.72rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.4rem;
    }
    .pred-bonus-pts {
      font-size: 0.65rem;
      background: rgba(59, 130, 246, 0.12);
      color: var(--accent-primary);
      border: 1px solid rgba(59,130,246,0.25);
      padding: 0.05rem 0.35rem;
      border-radius: 4px;
      font-weight: 700;
    }
    .pred-hint {
      font-size: 0.7rem;
      color: var(--text-secondary);
      opacity: 0.5;
      align-self: center;
    }

    /* ── Percentage bars ── */
    .pred-pct-area {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      margin-bottom: 0.5rem;
    }
    .pred-pct-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .pred-pct-team {
      font-size: 0.75rem;
      color: var(--text-secondary);
      width: 90px;
      min-width: 90px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pred-pct-team--voted {
      color: #10b981;
      font-weight: 700;
    }
    .pred-pct-track {
      flex: 1;
      height: 6px;
      background: rgba(255,255,255,0.07);
      border-radius: 999px;
      overflow: hidden;
    }
    .pred-pct-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.5s ease;
    }
    .pred-pct-fill--a { background: #3b82f6; }
    .pred-pct-fill--b { background: #f43f5e; }
    .pred-pct-val {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-secondary);
      width: 32px;
      text-align: right;
    }
    .pred-pct-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.15rem;
    }
    .pred-pct-total-label {
      font-size: 0.68rem;
      color: var(--text-secondary);
      opacity: 0.6;
    }

    .pred-opts {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .pred-opt {
      padding: 0.28rem 0.65rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.18s;
    }
    .pred-opt:not(:disabled):hover {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }
    .pred-opt--selected {
      background: rgba(59, 130, 246, 0.18) !important;
      border-color: var(--accent-primary) !important;
      color: white !important;
    }
    .pred-opt:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .pred-opt--over.pred-opt--selected {
      background: rgba(16, 185, 129, 0.18) !important;
      border-color: #10b981 !important;
      color: #10b981 !important;
    }
    .pred-opt--under.pred-opt--selected {
      background: rgba(244, 63, 94, 0.18) !important;
      border-color: #f43f5e !important;
      color: #f43f5e !important;
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  supabase    = inject(SupabaseService);
  predSvc     = inject(PredictionService);

  allMatches  = signal<Match[]>([]);
  filterStatus = signal<string>('all');
  loading     = signal(true);

  votedState  = signal<Record<string, LocalVote>>({});
  percentages = signal<Record<string, VotePercentages>>({});

  pendingVote  = signal<{ matchId: string; side: 'A' | 'B' } | null>(null);
  tempUsername = '';
  nameError    = signal<string | null>(null);
  checkingName = signal(false);

  private realtimeChannel: any = null;
  private realtimePredChannel: any = null;

  editingMatchId = signal<string | null>(null);
  newMatchDate = '';

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

      if (a.status === 'scheduled') {
        const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
        const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
        return dateA - dateB;
      }

      if (a.status === 'finished') {
        const dateA = a.finished_at ? new Date(a.finished_at).getTime() : 0;
        const dateB = b.finished_at ? new Date(b.finished_at).getTime() : 0;
        return dateB - dateA;
      }

      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  });

  async ngOnInit() {
    await this.fetchMatches();
    this.setupRealtime();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
    if (this.realtimePredChannel) {
      this.supabase.client.removeChannel(this.realtimePredChannel);
    }
  }

  private setupRealtime() {
    this.realtimeChannel = this.supabase.client
      .channel('home_matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        this.fetchMatches();
      })
      .subscribe();

    this.realtimePredChannel = this.supabase.client
      .channel('home_predictions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        this.loadPercentagesForVoted();
      })
      .subscribe();
  }

  async fetchMatches() {
    this.loading.set(true);
    await this.supabase.fetchInitialData();
    const { data } = await this.supabase.client.from('matches').select('*');
    if (data) {
      this.allMatches.set(data as Match[]);
      await this.syncVotedState(data as Match[]);
      this.loadPercentagesForVoted();
    }
    this.loading.set(false);
  }

  // ── Predicciones ──────────────────────────────────────────

  private async syncVotedState(matches: Match[]) {
    const activeIds = await this.predSvc.getMyActiveMatchIds();

    const state: Record<string, LocalVote> = {};
    matches.forEach(m => {
      const v = this.predSvc.getVote(m.id!);
      if (!v) return;
      if (activeIds.has(m.id!)) {
        state[m.id!] = v;
      } else {
        // Supabase no tiene voto activo → el localStorage está desactualizado, limpiarlo
        localStorage.removeItem('av_vote_' + m.id);
      }
    });
    this.votedState.set(state);
  }

  async startVote(match: Match, side: 'A' | 'B') {
    if (this.predSvc.getUsername()) {
      await this.saveVote(match, side);
    } else {
      this.pendingVote.set({ matchId: match.id!, side });
    }
  }

  async confirmVote(match: Match) {
    const name = this.tempUsername.trim();
    if (!name) return;
    this.nameError.set(null);
    this.checkingName.set(true);
    const available = await this.predSvc.isUsernameAvailable(name);
    this.checkingName.set(false);
    if (!available) {
      this.nameError.set('Ese nombre ya está en uso, elige otro');
      return;
    }
    this.predSvc.setUsername(name);
    const pending = this.pendingVote();
    if (pending) await this.saveVote(match, pending.side);
    this.pendingVote.set(null);
    this.tempUsername = '';
  }

  cancelPendingVote() {
    this.pendingVote.set(null);
    this.tempUsername = '';
    this.nameError.set(null);
  }

  private async saveVote(match: Match, side: 'A' | 'B') {
    const winnerId = side === 'A' ? match.team_a_id : match.team_b_id;
    const ouLine = this.getOULine(match);
    const vote: LocalVote = { winnerId, ouLine, timestamp: Date.now() };
    await this.predSvc.saveVote(match.id!, vote);
    this.votedState.update(s => ({ ...s, [match.id!]: vote }));
    await this.loadPercentages(match);
  }

  setSetsVote(matchId: string, setsVote: string) {
    this.predSvc.updateVote(matchId, { setsVote });
    const updated = this.predSvc.getVote(matchId)!;
    this.votedState.update(s => ({ ...s, [matchId]: updated }));
  }

  setOUVote(matchId: string, vote: 'over' | 'under') {
    this.predSvc.updateVote(matchId, { ouVote: vote });
    const updated = this.predSvc.getVote(matchId)!;
    this.votedState.update(s => ({ ...s, [matchId]: updated }));
  }

  async clearVote(match: Match) {
    localStorage.removeItem('av_vote_' + match.id);
    this.votedState.update(s => { const u = { ...s }; delete u[match.id!]; return u; });
    this.percentages.update(p => { const u = { ...p }; delete u[match.id!]; return u; });
    await this.predSvc.clearVoteInSupabase(match.id!);
  }

  getSetsOptions(match: Match): string[] {
    return match.round === 'final' ? ['3-0', '3-1', '3-2'] : ['2-0', '2-1'];
  }

  getOULine(match: Match): number {
    const finished = this.allMatches().filter(m =>
      m.status === 'finished' &&
      (m.game_mode || 4) === (match.game_mode || 4) &&
      Array.isArray(m.point_history) &&
      m.point_history.length > 0
    );

    if (finished.length < 2) {
      return match.round === 'final' ? 145.5 : 100.5;
    }

    const avg = finished.reduce((sum, m) => sum + m.point_history.length, 0) / finished.length;
    return Math.floor(avg) + 0.5;
  }

  private async loadPercentages(match: Match) {
    if (!match.id) return;
    const pct = await this.predSvc.getVotePercentages(match.id, match.team_a_id, match.team_b_id);
    this.percentages.update(p => ({ ...p, [match.id!]: pct }));
  }

  private async loadPercentagesForVoted() {
    const matches = this.allMatches();
    const voted = this.votedState();
    for (const m of matches) {
      if (m.id && voted[m.id]) {
        const pct = await this.predSvc.getVotePercentages(m.id, m.team_a_id, m.team_b_id);
        this.percentages.update(p => ({ ...p, [m.id!]: pct }));
      }
    }
  }

  getPct(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 100);
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
    if (match.scheduled_at) {
      const date = new Date(match.scheduled_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      this.newMatchDate = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
      this.newMatchDate = '';
    }
  }

  async saveMatchDate(id: string) {
    const dateWithOffset = this.newMatchDate ? `${this.newMatchDate}:00-05:00` : null;
    await this.supabase.updateMatchState(id, { scheduled_at: dateWithOffset as any });
    this.editingMatchId.set(null);
    this.fetchMatches();
  }
}
