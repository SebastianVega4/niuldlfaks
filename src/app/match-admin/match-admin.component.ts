import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService, Match, Team, Player } from '../core/services/supabase.service';
import { CourtComponent } from '../court/court.component';

@Component({
  selector: 'app-match-admin',
  standalone: true,
  imports: [CommonModule, CourtComponent, FormsModule],
  templateUrl: './match-admin.component.html',
  styleUrls: ['./match-admin.component.scss']
})
export class MatchAdminComponent {
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);

  matchId = signal<string>('');
  match = signal<Match | null>(null);
  gameMode = signal<number>(6);
  teamA = signal<Team | null>(null);
  teamB = signal<Team | null>(null);

  // Score Signals
  scoreA = signal<number>(0);
  scoreB = signal<number>(0);
  setsA = signal<number>(0);
  setsB = signal<number>(0);
  pointHistory = signal<any[]>([]);
  sideSwapped = signal<boolean>(false);

  // Playing state
  status = signal<'scheduled' | 'live' | 'timeout' | 'finished'>('scheduled');
  serveState = signal<'A' | 'B'>('A');

  // Player arrays for Court (6 per side)
  playersA = signal<string[]>([]);
  playersB = signal<string[]>([]);

  // Available players for selection
  availablePlayersA = signal<Player[]>([]);
  availablePlayersB = signal<Player[]>([]);

  // Timer
  timerValue = signal(0);
  private timerInterval: any = null;

  // Edit State
  editMode = signal(false);
  editNameA = signal('');
  editNameB = signal('');
  editDate = signal('');

  isRotationEditable = computed(() => {
    return this.status() !== 'live' && this.scoreA() === 0 && this.scoreB() === 0;
  });

  getAvailableForPos(team: 'A' | 'B', index: number) {
    const selected = team === 'A' ? this.playersA() : this.playersB();
    const all = team === 'A' ? this.availablePlayersA() : this.availablePlayersB();
    return all.filter(p => !selected.includes(p.name) || selected[index] === p.name);
  }

  hasPointsInSet(setNum: number): boolean {
    const hasPoints = this.pointHistory().some(h => h.set === setNum);
    if (this.status() === 'finished') {
      return hasPoints;
    }
    const currentSet = this.setsA() + this.setsB() + 1;
    return hasPoints || (currentSet === setNum && currentSet <= 3);
  }

  constructor() {
    this.route.paramMap.subscribe(p => {
      const id = p.get('id');
      if (id) {
        this.matchId.set(id);
        this.loadMatch(id);
      }
    });

    // We can also use an effect to sync the match back to DB periodically, 
    // or do it explicitly on actions constraint
  }

  async loadMatch(id: string) {
    try {
      const data = await this.supabase.loadMatch(id);
      this.match.set(data);
      if (data.game_mode) this.gameMode.set(data.game_mode);
      this.teamA.set(data.team_a);
      this.teamB.set(data.team_b);
      this.editNameA.set(data.team_a.name);
      this.editNameB.set(data.team_b.name);
      if (data.scheduled_at) this.editDate.set(data.scheduled_at);
      
      this.scoreA.set(data.current_set_score[0]);
      this.scoreB.set(data.current_set_score[1]);
      this.setsA.set(data.score_sets[0]);
      this.setsB.set(data.score_sets[1]);
      this.pointHistory.set(data.point_history || []);

      this.playersA.set(this.ensureCorrectLength(data.rotation_state.team_a || []));
      this.playersB.set(this.ensureCorrectLength(data.rotation_state.team_b || []));
      
      this.status.set(data.status);
      this.timerValue.set(data.game_time || 0);
      
      // Assume serve starts randomly or whoever was winning last if reloaded. Not strictly defined.
      this.serveState.set('A'); 

      // Load available players
      this.loadTeamPlayers();

    } catch (err) {
      console.error(err);
    }
  }

  ensureCorrectLength(arr: string[]): string[] {
    const target = this.gameMode();
    if (arr.length === target) return arr;
    const newArr = [...arr];
    while (newArr.length < target) newArr.push('');
    return newArr.slice(0, target);
  }

  async loadTeamPlayers() {
    const tA = this.teamA();
    const tB = this.teamB();
    if (tA) {
      const { data } = await this.supabase.client.from('players').select('*').eq('team_id', tA.id);
      if (data) this.availablePlayersA.set(data);
    }
    if (tB) {
      const { data } = await this.supabase.client.from('players').select('*').eq('team_id', tB.id);
      if (data) this.availablePlayersB.set(data);
    }
  }

  updatePlayerPosition(team: 'A' | 'B', index: number, name: string) {
    if (team === 'A') {
      const p = [...this.playersA()];
      p[index] = name;
      this.playersA.set(p);
    } else {
      const p = [...this.playersB()];
      p[index] = name;
      this.playersB.set(p);
    }
    this.syncState();
  }

  startTimer() {
    if (this.status() === 'scheduled' || this.status() === 'timeout') {
      this.status.set('live');
      this.timerInterval = setInterval(() => {
        this.timerValue.update(v => v + 1000);
      }, 1000);
      this.syncState();
    }
  }

  pauseTimer() {
    this.status.set('timeout');
    clearInterval(this.timerInterval);
    this.syncState();
  }

  get formattedTime() {
    const totalSecs = Math.floor(this.timerValue() / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  addPoint(team: 'A' | 'B') {
    if (this.status() !== 'live') return;

    if (team === 'A') {
      this.scoreA.update(s => s + 1);
      if (this.serveState() === 'B') {
        this.rotateTeam('A');
        this.serveState.set('A');
      }
    } else {
      this.scoreB.update(s => s + 1);
      if (this.serveState() === 'A') {
        this.rotateTeam('B');
        this.serveState.set('B');
      }
    }

    this.pointHistory.update(h => [...h, {
      set: this.setsA() + this.setsB() + 1,
      team,
      scoreA: this.scoreA(),
      scoreB: this.scoreB()
    }]);

    this.checkSetWinner();
    this.syncState();
  }
  
  removePoint(team: 'A' | 'B') {
    if (this.status() !== 'live') return;
    if (team === 'A' && this.scoreA() > 0) {
      this.scoreA.update(s => s - 1);
      this.removeLastHistoryPoint('A');
    } else if (team === 'B' && this.scoreB() > 0) {
      this.scoreB.update(s => s - 1);
      this.removeLastHistoryPoint('B');
    }
    this.syncState();
  }

  removeLastHistoryPoint(team: 'A' | 'B') {
    this.pointHistory.update(h => {
      // Encontrar el índice del último punto de ese equipo
      const lastIndex = [...h].reverse().findIndex(p => p.team === team);
      if (lastIndex !== -1) {
        const actualIndex = h.length - 1 - lastIndex;
        const newHistory = [...h];
        newHistory.splice(actualIndex, 1);
        return newHistory;
      }
      return h;
    });
  }

  rotateTeam(team: 'A' | 'B') {
    if (team === 'A') {
      const arr = [...this.playersA()];
      if (arr.length > 0) {
        const p1 = arr.shift();
        arr.push(p1 as string);
        this.playersA.set(arr);
      }
    } else {
      const arr = [...this.playersB()];
      if (arr.length > 0) {
        const p1 = arr.shift();
        arr.push(p1 as string);
        this.playersB.set(arr);
      }
    }
  }

  checkSetWinner() {
    const a = this.scoreA();
    const b = this.scoreB();
    const currentSet = this.setsA() + this.setsB() + 1;
    
    // Final is 3 of 5, others 2 of 3
    const isFinal = this.match()?.round === 'final';
    const setsToWin = isFinal ? 3 : 2;
    const maxSets = isFinal ? 5 : 3;
    
    // Last set limit is 15, others 25
    const SET_LIMIT = currentSet === maxSets ? 15 : 25; 

    if ((a >= SET_LIMIT && a - b >= 2) || (b >= SET_LIMIT && b - a >= 2)) {
       if (a > b) this.setsA.update(s => s + 1);
       else this.setsB.update(s => s + 1);
       
       if (this.setsA() === setsToWin || this.setsB() === setsToWin) {
           this.status.set('finished');
           if (this.timerInterval) clearInterval(this.timerInterval);
           this.updateTeamStatsAfterFinish();
           this.supabase.checkTournamentProgression();
       } else {
           this.sideSwapped.update(s => !s);
           this.scoreA.set(0);
           this.scoreB.set(0);
           this.pauseTimer();
       }
    }
  }

  async updateTeamStatsAfterFinish() {
    const tA = this.teamA();
    const tB = this.teamB();
    if (!tA || !tB) return;

    // A wins
    if (this.setsA() > this.setsB()) {
        await this.updateTeam(tA.id!, {
           sets_ganados: (tA.stats.sets_ganados || 0) + this.setsA(),
           puntos_total: (tA.stats.puntos_total || 0) + (this.scoreA() + (this.setsA() > 1 ? 25 : 0)), // Simple sum
           diferencia: (tA.stats.diferencia || 0) + (this.setsA() - this.setsB())
        });
        await this.updateTeam(tB.id!, {
           sets_ganados: (tB.stats.sets_ganados || 0) + this.setsB(),
           puntos_total: (tB.stats.puntos_total || 0) + (this.scoreB()),
           diferencia: (tB.stats.diferencia || 0) + (this.setsB() - this.setsA())
        });
    } else {
        // B wins
        await this.updateTeam(tB.id!, {
           sets_ganados: (tB.stats.sets_ganados || 0) + this.setsB(),
           puntos_total: (tB.stats.puntos_total || 0) + (this.scoreB() + (this.setsB() > 1 ? 25 : 0)),
           diferencia: (tB.stats.diferencia || 0) + (this.setsB() - this.setsA())
        });
        await this.updateTeam(tA.id!, {
           sets_ganados: (tA.stats.sets_ganados || 0) + this.setsA(),
           puntos_total: (tA.stats.puntos_total || 0) + (this.scoreA()),
           diferencia: (tA.stats.diferencia || 0) + (this.setsA() - this.setsB())
        });
    }
    // Double check progression after stats update
    await this.supabase.checkTournamentProgression();
  }

  async updateTeam(id: string, stats: any) {
    await this.supabase.client.from('teams').update({ stats }).eq('id', id);
  }

  async saveSettings() {
    try {
      if (this.teamA()) await this.supabase.updateTeamName(this.teamA()!.id!, this.editNameA());
      if (this.teamB()) await this.supabase.updateTeamName(this.teamB()!.id!, this.editNameB());
      
      await this.supabase.updateMatchState(this.matchId(), {
        scheduled_at: this.editDate()
      });
      
      await this.loadMatch(this.matchId());
      this.editMode.set(false);
    } catch (err) {
      alert('Error al guardar cambios');
    }
  }

  async syncState() {
    const currentMatch = this.match();
    await this.supabase.updateMatchState(this.matchId(), {
       current_set_score: [this.scoreA(), this.scoreB()],
       score_sets: [this.setsA(), this.setsB()],
       status: this.status(),
       game_time: this.timerValue(),
       rotation_state: {
          team_a: this.playersA(),
          team_b: this.playersB()
       },
       point_history: this.pointHistory(),
       finished_at: this.status() === 'finished' ? new Date().toISOString() : null,
       round: currentMatch?.round || 'group',
       bracket_position: currentMatch?.bracket_position || 'group_match'
    });
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    // Explicit sync 
    if (this.matchId() && this.status() !== 'finished') {
       this.syncState();
    }
  }
}
