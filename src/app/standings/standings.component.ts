import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService, Team, Match } from '../core/services/supabase.service';

interface PlayoffMatch {
  id: string;
  team_a: Team;
  team_b: Team;
  round: string;
  bracket_position: string;
  status: string;
  score_sets: number[];
}

@Component({
  selector: 'app-standings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './standings.component.html',
  styleUrls: ['./standings.component.scss']
})
export class StandingsComponent implements OnInit, OnDestroy {
  supabase = inject(SupabaseService);

  teamsA = signal<Team[]>([]);
  teamsB = signal<Team[]>([]);
  
  allMatches = signal<Match[]>([]);
  playoffMatches = signal<PlayoffMatch[]>([]);
  groupsComplete = signal(false);
  loading = signal(true);
  showGenerateButton = signal(false);
  
  private matchSubscription: any;

  ngOnInit() {
    this.loadData();
    this.setupRealtime();
  }

  setupRealtime() {
    this.matchSubscription = this.supabase.client.channel('standings_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        this.loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        this.loadData();
      })
      .subscribe();
  }

  async loadData() {
    // 1. Fetch Fresh Teams
    const { data: tData } = await this.supabase.client.from('teams').select('*');
    if (tData) {
      this.supabase.teams.set(tData);
      this.verifyData();
    }

    // 2. Fetch All Matches
    const matches = await this.supabase.getAllMatches();
    this.allMatches.set(matches);
    
    // Filter playoffs
    this.playoffMatches.set(matches.filter(m => m.round === 'semifinal' || m.round === 'final') as any);
    
    await this.checkGroupsPhase();
    this.loading.set(false);
  }

  verifyData() {
    const tList = [...this.supabase.teams()];
    
    const sortFn = (a: Team, b: Team) => {
      // 1. Primary: Sets won
      const setsDiff = (b.stats.sets_ganados || 0) - (a.stats.sets_ganados || 0);
      if (setsDiff !== 0) return setsDiff;
      
      // 2. Secondary: Difference (points or set diff)
      const diff = (b.stats.diferencia || 0) - (a.stats.diferencia || 0);
      if (diff !== 0) return diff;

      // 3. Points total
      return (b.stats.puntos_total || 0) - (a.stats.puntos_total || 0);
    };

    this.teamsA.set(tList.filter(t => t.group === 'A').sort(sortFn));
    this.teamsB.set(tList.filter(t => t.group === 'B').sort(sortFn));
  }

  getMatchesByGroup(group: 'A' | 'B'): Match[] {
    const groupTeamsIds = this.supabase.teams()
      .filter(t => t.group === group)
      .map(t => t.id);
      
    return this.allMatches().filter(m => 
      m.round === 'group' && 
      (groupTeamsIds.includes(m.team_a_id) || groupTeamsIds.includes(m.team_b_id))
    );
  }

  async checkGroupsPhase() {
    const isComplete = await this.supabase.checkGroupsPhaseComplete();
    this.groupsComplete.set(isComplete);
    
    // Only show button if group phase is complete and NO semifinals exist yet
    if (isComplete) {
      const { data: semiMatches } = await this.supabase.client
        .from('matches')
        .select('id')
        .eq('round', 'semifinal');
      
      this.showGenerateButton.set(!semiMatches || semiMatches.length === 0);
    } else {
      this.showGenerateButton.set(false);
    }
  }

  async generatePlayoffs() {
    const qualified = await this.supabase.getQualifiedTeams();
    if (qualified.length < 4) {
      alert('Se necesitan al menos 4 equipos clasificados');
      return;
    }
    const result = await this.supabase.generatePlayoffMatches(qualified);
    if (result.success) {
      alert('¡Playoffs generados!');
      this.loadData();
    }
  }

  async generateFinal() {
    const result = await this.supabase.generateFinalMatch();
    if (result.success) {
      alert('¡Final generada!');
      this.loadData();
    }
  }

  getSemifinal1(): PlayoffMatch | undefined {
    return this.playoffMatches().find(m => m.bracket_position === 'semi_1');
  }

  getSemifinal2(): PlayoffMatch | undefined {
    return this.playoffMatches().find(m => m.bracket_position === 'semi_2');
  }

  getFinal(): PlayoffMatch | undefined {
    return this.playoffMatches().find(m => m.round === 'final');
  }

  getWinner(match: any): Team | null {
    if (!match || match.status !== 'finished') return null;
    return match.score_sets[0] > match.score_sets[1] ? match.team_a : match.team_b;
  }

  getTeamName(team: Team | undefined | null): string {
    return team?.name || 'Por definir';
  }

  async refreshTournament() {
    await this.supabase.checkTournamentProgression();
    await this.loadData();
  }

  ngOnDestroy() {
    if (this.matchSubscription) {
      this.supabase.client.removeChannel(this.matchSubscription);
    }
  }
}
