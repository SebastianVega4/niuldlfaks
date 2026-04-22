import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://numrhzlsrlhcixilltiq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bXJoemxzcmxoY2l4aWxsdGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDI1NDYsImV4cCI6MjA5MTU3ODU0Nn0.XfD3aDy3nhycmRY4bwOGbkuI-1sKZ-a1dTU2kgYtazI';

export interface Player {
  id?: string;
  name: string;
  team_id?: string;
  is_leader: boolean;
  created_at?: string;
}

export interface Team {
  id?: string;
  name: string;
  group?: string;
  stats: {
    sets_ganados: number;
    puntos_total: number;
    diferencia: number;
  };
  created_at?: string;
}

export interface Match {
  id?: string;
  team_a_id: string;
  team_b_id: string;
  score_sets: number[];
  current_set_score: number[];
  rotation_state: {
    team_a: string[];
    team_b: string[];
    side_swapped?: boolean;
  };
  status: 'scheduled' | 'live' | 'timeout' | 'finished';
  game_mode?: number;
  game_time: number;
  point_history: any[];
  scheduled_at?: string;
  finished_at?: string | null;
  created_at?: string;
  round?: string;
  bracket_position?: string;
  team_a?: Team;
  team_b?: Team;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private router = inject(Router);

  // Global Signals for State
  isAdmin = signal<boolean>(false);
  players = signal<Player[]>([]);
  teams = signal<Team[]>([]);
  liveMatches = signal<Match[]>([]);

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Auth Listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.isAdmin.set(!!session);
    });

    this.fetchInitialData();
  }

  get client() {
    return this.supabase;
  }

  async signIn(email: string, pass: string) {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    this.router.navigate(['/sorteo']);
  }

  async signOut() {
    await this.supabase.auth.signOut();
    this.router.navigate(['/']);
  }

  async fetchInitialData() {
    const { data: pData } = await this.supabase.from('players').select('*');
    if (pData) this.players.set(pData);

    const { data: tData } = await this.supabase.from('teams').select('*');
    if (tData) this.teams.set(tData);
  }

  async saveDraft(generatedTeams: {team: any, players: Player[]}[]) {
    try {
      const createdTeamIds: string[] = [];
      for (const data of generatedTeams) {
        // 1. Insert Team
        const { data: teamData, error: tErr } = await this.supabase
          .from('teams')
          .insert({
            name: data.team.name,
            group: data.team.group,
            stats: data.team.stats
          })
          .select()
          .single();
          
        if (tErr) throw new Error(`Error inserting team ${data.team.name}: ${tErr.message}`);
        if (!teamData) throw new Error(`Failed to retrieve inserted team data for ${data.team.name}`);

        createdTeamIds.push(teamData.id);

        // 2. Map team_id to players
        const playersToInsert = data.players.map(p => ({
          name: p.name,
          team_id: teamData.id,
          is_leader: p.is_leader
        }));

        const { error: pErr } = await this.supabase.from('players').insert(playersToInsert);
        if (pErr) throw new Error(`Error inserting players for team ${data.team.name}: ${pErr.message}`);
      }
      
      await this.fetchInitialData();
      return { success: true, teamIds: createdTeamIds };
    } catch (error: any) {
      console.error('Draft save failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Realtime matches
  subscribeToMatches(matchId?: string) {
    let query = this.supabase.channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, payload => {
        // Handle update internally or trigger a re-fetch
        console.log('Realtime match update received!', payload);
        if (payload.new) {
          this.liveMatches.update(matches => {
            const index = matches.findIndex(m => m.id === (payload.new as any)['id']);
            if (index >= 0) {
              const updated = [...matches];
              updated[index] = payload.new as Match;
              return updated;
            } else {
              return [...matches, payload.new as Match];
            }
          });
        }
      })
      .subscribe();
      
    return query;
  }

  async loadMatch(id: string) {
    const { data, error } = await this.supabase
      .from('matches')
      .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    // update live matches sign
    this.liveMatches.update(matches => {
      const idx = matches.findIndex(m => m.id === id);
      if (idx >= 0) {
        matches[idx] = data;
        return [...matches];
      }
      return [...matches, data];
    });
    
    return data;
  }

  async updateMatchState(id: string, updates: Partial<Match>) {
    const { error } = await this.supabase
      .from('matches')
      .update(updates)
      .eq('id', id);
      
    if (error) {
      console.error('Failed to update match', error);
    }
  }

  async updateTeamName(id: string, name: string) {
    const { error } = await this.supabase
      .from('teams')
      .update({ name })
      .eq('id', id);
    if (error) throw error;
    await this.fetchInitialData();
  }

  async checkTournamentProgression() {
    console.log('Checking tournament progression...');
    
    // 1. Check if group phase is complete
    const groupComplete = await this.checkGroupsPhaseComplete();
    if (groupComplete) {
      const { data: semiMatches } = await this.supabase
        .from('matches')
        .select('id')
        .eq('round', 'semifinal');
      
      if (!semiMatches || semiMatches.length === 0) {
        console.log('Group phase complete. Generating semifinals...');
        const qualified = await this.getQualifiedTeams();
        if (qualified.length >= 4) {
          await this.generatePlayoffMatches(qualified);
        }
      } else {
        // 2. Check if semifinals are complete
        const semisFinished = await this.checkSemisPhaseComplete();
        if (semisFinished) {
          const { data: finalMatch } = await this.supabase
            .from('matches')
            .select('id')
            .eq('round', 'final');
          
          if (!finalMatch || finalMatch.length === 0) {
            console.log('Semifinals complete. Generating final...');
            await this.generateFinalMatch();
          }
        }
      }
    }
  }

  async checkGroupsPhaseComplete(): Promise<boolean> {
    const { data: matches } = await this.supabase
      .from('matches')
      .select('status')
      .eq('round', 'group');

    if (!matches || matches.length === 0) return false;
    
    return matches.every(m => m.status === 'finished');
  }

  async checkSemisPhaseComplete(): Promise<boolean> {
    const { data: matches } = await this.supabase
      .from('matches')
      .select('status')
      .eq('round', 'semifinal');

    if (!matches || matches.length < 2) return false;
    
    return matches.every(m => m.status === 'finished');
  }

  async getQualifiedTeams(): Promise<{ group: string, teamId: string }[]> {
    const { data: teamsList, error } = await this.supabase.from('teams').select('*');
    if (error || !teamsList) return [];

    const sortFn = (a: Team, b: Team) => {
      // Primary: Sets won
      const setsDiff = (b.stats.sets_ganados || 0) - (a.stats.sets_ganados || 0);
      if (setsDiff !== 0) return setsDiff;
      // Secondary: Point difference (or total points as fallback)
      return (b.stats.diferencia || 0) - (a.stats.diferencia || 0);
    };

    const groupA = teamsList.filter(t => t.group === 'A').sort(sortFn);
    const groupB = teamsList.filter(t => t.group === 'B').sort(sortFn);

    const qualified: { group: string, teamId: string }[] = [];

    // Top 2 from A and Top 2 from B
    if (groupA.length >= 2) {
      qualified.push({ group: 'A', teamId: groupA[0].id! });
      qualified.push({ group: 'A', teamId: groupA[1].id! });
    }
    if (groupB.length >= 2) {
      qualified.push({ group: 'B', teamId: groupB[0].id! });
      qualified.push({ group: 'B', teamId: groupB[1].id! });
    }

    return qualified;
  }

  async generatePlayoffMatches(qualifiedTeams: { group: string, teamId: string }[]) {
    try {
      const groupA = qualifiedTeams.filter(t => t.group === 'A');
      const groupB = qualifiedTeams.filter(t => t.group === 'B');

      const semifinals = [];

      if (groupA.length >= 2 && groupB.length >= 2) {
        // 1st A vs 2nd B
        semifinals.push({
          team_a_id: groupA[0].teamId,
          team_b_id: groupB[1].teamId,
          round: 'semifinal',
          bracket_position: 'semi_1',
          status: 'scheduled',
          game_mode: 4, // 4x4 configuration
          score_sets: [0, 0],
          current_set_score: [0, 0],
          point_history: [],
          game_time: 0,
          rotation_state: { team_a: [], team_b: [] }
        });
        // 1st B vs 2nd A
        semifinals.push({
          team_a_id: groupB[0].teamId,
          team_b_id: groupA[1].teamId,
          round: 'semifinal',
          bracket_position: 'semi_2',
          status: 'scheduled',
          game_mode: 4, // 4x4 configuration
          score_sets: [0, 0],
          current_set_score: [0, 0],
          point_history: [],
          game_time: 0,
          rotation_state: { team_a: [], team_b: [] }
        });
      }

      if (semifinals.length > 0) {
        const { error } = await this.supabase.from('matches').insert(semifinals);
        if (error) throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error generating playoff matches:', error);
      return { success: false, error: error.message };
    }
  }

  async generateFinalMatch() {
    try {
      // Avoid generating multiple finals
      const { data: existingFinal } = await this.supabase
        .from('matches')
        .select('id')
        .eq('round', 'final');
      
      if (existingFinal && existingFinal.length > 0) {
        return { success: false, error: 'Final ya generada' };
      }

      const { data: semis } = await this.supabase
        .from('matches')
        .select('*')
        .eq('round', 'semifinal')
        .eq('status', 'finished');

      if (!semis || semis.length < 2) return { success: false, error: 'Semifinales no completadas' };

      const winners: string[] = [];
      const semi1 = semis.find(s => s.bracket_position === 'semi_1');
      const semi2 = semis.find(s => s.bracket_position === 'semi_2');

      if (semi1) winners.push(semi1.score_sets[0] > semi1.score_sets[1] ? semi1.team_a_id : semi1.team_b_id);
      if (semi2) winners.push(semi2.score_sets[0] > semi2.score_sets[1] ? semi2.team_a_id : semi2.team_b_id);

      if (winners.length === 2) {
        const { error } = await this.supabase.from('matches').insert({
          team_a_id: winners[0],
          team_b_id: winners[1],
          round: 'final',
          bracket_position: 'final',
          status: 'scheduled',
          game_mode: 4, // Requested 4x4 for final
          game_time: 0,
          score_sets: [0, 0],
          current_set_score: [0, 0],
          point_history: [],
          rotation_state: { team_a: [], team_b: [] }
        });

        if (error) throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error generating final match:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllMatches() {
    const { data, error } = await this.supabase
      .from('matches')
      .select('*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching all matches:', error);
      return [];
    }
    return data || [];
  }

  async getPlayoffMatches() {
    const { data } = await this.supabase
      .from('matches')
      .select('*, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)')
      .in('round', ['semifinal', 'final'])
      .order('created_at', { ascending: true });
    
    return data || [];
  }
}
