import { Component, inject, signal, effect, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService, Match, Team } from '../core/services/supabase.service';
import { PredictionService } from '../core/services/prediction.service';
import { CourtComponent } from '../court/court.component';

@Component({
  selector: 'app-live-match',
  standalone: true,
  imports: [CommonModule, CourtComponent],
  templateUrl: './live-match.component.html',
  styleUrls: ['./live-match.component.scss']
})
export class LiveMatchComponent implements OnDestroy {
  private supabase = inject(SupabaseService);
  private predSvc = inject(PredictionService);
  private route = inject(ActivatedRoute);
  private matchLoaded = false;

  match = signal<Match | null>(null);
  
  // Computed values
  teamA = signal<Team | null>(null);
  teamB = signal<Team | null>(null);

  scoreA = signal<number>(0);
  scoreB = signal<number>(0);
  setsA = signal<number>(0);
  setsB = signal<number>(0);
  pointHistory = signal<any[]>([]);

  playersA = signal<string[]>([]);
  playersB = signal<string[]>([]);

  sideSwapped = signal<boolean>(false);
  inverted = signal<boolean>(false);

  teamOnLeft = computed(() => (this.sideSwapped() === this.inverted()) ? 'A' : 'B');

  status = signal<string>('scheduled');
  serveState = signal<'A' | 'B'>('A');

  private realtimeSubscription: any = null;

  constructor() {
    this.route.paramMap.subscribe(p => {
      const id = p.get('id');
      if (id) {
        this.loadMatch(id);
      }
    });

    // Listen to changes in liveMatches signal
    effect(() => {
      const allLive = this.supabase.liveMatches();
      if (this.match()) {
        const updated = allLive.find(m => m.id === this.match()?.id);
        if (updated) {
          this.applyUpdates(updated);
        }
      }
    });
  }

  async loadMatch(id: string) {
    try {
      const data = await this.supabase.loadMatch(id);
      this.match.set(data);
      if (data.team_a) this.teamA.set(data.team_a);
      if (data.team_b) this.teamB.set(data.team_b);
      this.applyUpdates(data);
      
      // Start real-time subscription
      this.realtimeSubscription = this.supabase.subscribeToMatches(id);
    } catch (err) {
      console.error('Error loading public match', err);
    }
  }

  applyUpdates(data: Match) {
    const prevStatus = this.status();

    this.scoreA.set(data.current_set_score[0] || 0);
    this.scoreB.set(data.current_set_score[1] || 0);
    this.setsA.set(data.score_sets[0] || 0);
    this.setsB.set(data.score_sets[1] || 0);
    this.pointHistory.set(data.point_history || []);

    this.playersA.set(data.rotation_state?.team_a || []);
    this.playersB.set(data.rotation_state?.team_b || []);
    this.sideSwapped.set(data.rotation_state?.side_swapped || false);

    this.status.set(data.status);

    if (data.point_history && data.point_history.length > 0) {
      this.serveState.set(data.point_history[data.point_history.length - 1].team);
    }

    if (this.matchLoaded && prevStatus !== 'finished' && data.status === 'finished' && data.id) {
      this.predSvc.calculateAndSavePoints(data.id, data);
    }

    this.matchLoaded = true;
  }

  getTeamName(id: string | undefined): string {
    if (!id) return '...';
    const t = this.supabase.teams().find(x => x.id === id);
    return t ? t.name : 'Equipo';
  }

  formatDuration(ms: number | undefined): string {
    if (!ms) return '00:00';
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  hasPointsInSet(setNum: number): boolean {
    const hasPoints = this.pointHistory().some(h => h.set === setNum);
    if (this.status() === 'finished') {
      return hasPoints;
    }
    const currentSet = this.setsA() + this.setsB() + 1;
    return hasPoints || (currentSet === setNum && currentSet <= 3);
  }

  ngOnDestroy() {
    if (this.realtimeSubscription) {
      this.supabase.client.removeChannel(this.realtimeSubscription);
    }
  }
}
