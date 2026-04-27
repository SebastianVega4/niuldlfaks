import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../core/services/supabase.service';
import { PredictionService } from '../core/services/prediction.service';

interface LeaderEntry {
  deviceId: string;
  username: string;
  total: number;
  votos: number;
  acertados: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container pb-8">

      <!-- Header -->
      <div class="glass-panel text-center" style="padding: 3rem 2rem; margin-bottom: 2rem; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);">
        <h1 class="title-glow" style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏆 Ranking de Predicciones</h1>
        <p style="color: var(--text-secondary); font-size: 1rem;">El que más acierte se lleva el premio</p>
      </div>

      <!-- Points system -->
      <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
        <h3 style="color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; margin-bottom: 1rem;">Sistema de puntos</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
          <div class="point-chip">
            <span class="chip-pts">1 pt</span>
            <span class="chip-label">Ganador correcto</span>
          </div>
          <div class="point-chip">
            <span class="chip-pts">2 pts</span>
            <span class="chip-label">Sets exactos</span>
          </div>
          <div class="point-chip">
            <span class="chip-pts">1 pt</span>
            <span class="chip-label">Over/Under</span>
          </div>
          <div class="point-chip point-chip--max">
            <span class="chip-pts">4 pts</span>
            <span class="chip-label">Máximo por partido</span>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="glass-panel text-center" style="padding: 3rem;">
        <span style="color: var(--text-secondary); font-size: 1.1rem;">Cargando ranking...</span>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading() && entries().length === 0" class="glass-panel text-center" style="padding: 4rem 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔮</div>
        <h2 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--text-primary);">Aún no hay predicciones</h2>
        <p style="color: var(--text-secondary); font-size: 0.95rem;">Vota en los partidos para aparecer en el ranking.</p>
      </div>

      <!-- Ranking table -->
      <div *ngIf="!loading() && entries().length > 0" class="glass-panel" style="padding: 0; overflow: hidden;">
        <div class="lb-row lb-header">
          <span class="lb-rank">#</span>
          <span class="lb-name">Jugador</span>
          <span class="lb-pts">Pts</span>
          <span class="lb-stat">Votos</span>
          <span class="lb-stat">Acertados</span>
        </div>
        <div *ngFor="let entry of entries(); let i = index"
             class="lb-row"
             [class.lb-row--me]="entry.deviceId === myDeviceId"
             [class.lb-row--top]="i < 3">
          <span class="lb-rank">
            <span *ngIf="i < 3">{{ medals[i] }}</span>
            <span *ngIf="i >= 3" style="color: var(--text-secondary);">{{ i + 1 }}</span>
          </span>
          <span class="lb-name">
            {{ entry.username }}
            <span *ngIf="entry.deviceId === myDeviceId" class="lb-you-tag">tú</span>
          </span>
          <span class="lb-pts lb-pts--val">{{ entry.total }}</span>
          <span class="lb-stat">{{ entry.votos }}</span>
          <span class="lb-stat">{{ entry.acertados }}</span>
        </div>
      </div>

      <!-- Nota -->
      <div *ngIf="!loading() && entries().length > 0" style="text-align: center; margin-top: 0.75rem;">
        <span style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.6;">
          Votos = predicciones hechas &nbsp;·&nbsp; Acertados = con puntos ganados &nbsp;·&nbsp; Los puntos se calculan al finalizar cada partido
        </span>
      </div>

      <!-- Código de verificación del usuario -->
      <div *ngIf="myUsername()" class="glass-panel" style="margin-top: 1.5rem; padding: 1.25rem; border-color: rgba(59,130,246,0.25);">
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">Tu código de verificación</p>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.5;">
          Al terminar el torneo, el ganador debe mostrar este código para confirmar su identidad.
        </p>
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <span class="verify-name">{{ myUsername() }}</span>
          <span class="verify-code">{{ verifyCode() }}</span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .point-chip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
      padding: 0.5rem 1rem;
    }
    .point-chip--max {
      background: rgba(251, 191, 36, 0.06);
      border-color: rgba(251, 191, 36, 0.2);
    }
    .chip-pts {
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--accent-primary);
    }
    .point-chip--max .chip-pts { color: #fbbf24; }
    .chip-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    /* Ranking table */
    .lb-row {
      display: grid;
      grid-template-columns: 48px 1fr 60px 60px 80px;
      align-items: center;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.15s;
    }
    .lb-row:last-child { border-bottom: none; }
    .lb-header {
      background: rgba(255,255,255,0.04);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      padding-top: 0.7rem;
      padding-bottom: 0.7rem;
    }
    .lb-row--top { background: rgba(251, 191, 36, 0.03); }
    .lb-row--me {
      background: rgba(59, 130, 246, 0.08);
      border-left: 3px solid var(--accent-primary);
    }
    .lb-row:not(.lb-header):hover { background: rgba(255,255,255,0.04); }
    .lb-rank {
      font-size: 1.1rem;
      text-align: center;
    }
    .lb-name {
      font-weight: 600;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lb-you-tag {
      font-size: 0.62rem;
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-primary);
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 0.05rem 0.4rem;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .lb-pts {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    .lb-pts--val {
      font-size: 1.3rem;
      font-weight: 800;
      color: #fbbf24;
    }
    .lb-stat {
      text-align: center;
      font-size: 0.88rem;
      color: var(--text-secondary);
    }

    /* Verification */
    .verify-name {
      font-weight: 700;
      font-size: 1rem;
      color: var(--text-primary);
    }
    .verify-code {
      font-family: monospace;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 2px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: var(--accent-primary);
      padding: 0.3rem 0.75rem;
      border-radius: 6px;
    }

    @media (max-width: 480px) {
      .lb-row {
        grid-template-columns: 40px 1fr 50px 50px 64px;
        padding: 0.7rem 0.75rem;
      }
      .lb-pts--val { font-size: 1.1rem; }
    }
  `]
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private predSvc = inject(PredictionService);

  myDeviceId = this.predSvc.getDeviceId();
  myUsername = this.predSvc.username;

  loading = signal(true);
  entries = signal<LeaderEntry[]>([]);
  medals = MEDALS;

  verifyCode = signal<string>('');

  private realtimeChannel: any = null;

  async ngOnInit() {
    this.verifyCode.set(this.myDeviceId.slice(-8).toUpperCase());
    await this.fetchLeaderboard();
    this.setupRealtime();
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
  }

  private async fetchLeaderboard() {
    this.loading.set(true);
    const { data } = await this.supabase.client
      .from('predictions')
      .select('device_id, username, points');

    if (data) {
      const map: Record<string, LeaderEntry> = {};
      data.forEach(row => {
        if (!row.username) return;
        const key = row.device_id;
        if (!map[key]) map[key] = { deviceId: key, username: row.username, total: 0, votos: 0, acertados: 0 };
        map[key].username = row.username;
        map[key].total += row.points || 0;
        map[key].votos++;
        if ((row.points || 0) > 0) map[key].acertados++;
      });
      this.entries.set(
        Object.values(map).sort((a, b) => b.total - a.total || b.acertados - a.acertados)
      );
    }
    this.loading.set(false);
  }

  private setupRealtime() {
    this.realtimeChannel = this.supabase.client
      .channel('leaderboard_predictions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        this.fetchLeaderboard();
      })
      .subscribe();
  }
}
