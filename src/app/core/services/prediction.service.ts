import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService, Match } from './supabase.service';

export interface LocalVote {
  winnerId: string;
  setsVote?: string;
  ouVote?: string;
  ouLine?: number;
  timestamp: number;
}

export interface VotePercentages {
  aCount: number;
  bCount: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private supabase = inject(SupabaseService);

  private readonly DEVICE_KEY = 'av_device_id';
  private readonly USERNAME_KEY = 'av_username';
  private readonly VOTE_PREFIX = 'av_vote_';

  username = signal<string | null>(localStorage.getItem(this.USERNAME_KEY));

  getDeviceId(): string {
    let id = localStorage.getItem(this.DEVICE_KEY);
    if (!id) {
      id = this.generateId();
      localStorage.setItem(this.DEVICE_KEY, id);
    }
    return id;
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  getUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY);
  }

  setUsername(name: string) {
    const trimmed = name.trim();
    localStorage.setItem(this.USERNAME_KEY, trimmed);
    this.username.set(trimmed);
  }

  getVote(matchId: string): LocalVote | null {
    const raw = localStorage.getItem(this.VOTE_PREFIX + matchId);
    return raw ? JSON.parse(raw) : null;
  }

  async saveVote(matchId: string, vote: LocalVote) {
    localStorage.setItem(this.VOTE_PREFIX + matchId, JSON.stringify(vote));
    const username = this.getUsername() || 'Anónimo';
    const deviceId = this.getDeviceId();
    await this.supabase.client.from('predictions').upsert({
      match_id: matchId,
      device_id: deviceId,
      username,
      winner_vote: vote.winnerId,
      sets_vote: vote.setsVote ?? null,
      ou_vote: vote.ouVote ?? null,
      ou_line: vote.ouLine ?? null,
    }, { onConflict: 'match_id,device_id' });
  }

  updateVote(matchId: string, partial: Partial<Omit<LocalVote, 'timestamp'>>) {
    const existing = this.getVote(matchId);
    if (!existing) return;
    const updated = { ...existing, ...partial };
    localStorage.setItem(this.VOTE_PREFIX + matchId, JSON.stringify(updated));
    const deviceId = this.getDeviceId();
    this.supabase.client.from('predictions')
      .update({ sets_vote: updated.setsVote ?? null, ou_vote: updated.ouVote ?? null })
      .eq('match_id', matchId)
      .eq('device_id', deviceId)
      .then(() => {});
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const myDeviceId = this.getDeviceId();
    const { data } = await this.supabase.client
      .from('predictions')
      .select('device_id')
      .ilike('username', username.trim())
      .neq('device_id', myDeviceId)
      .limit(1);
    return !data || data.length === 0;
  }

  async clearVoteInSupabase(matchId: string) {
    const deviceId = this.getDeviceId();
    await this.supabase.client.from('predictions')
      .update({ username: '', winner_vote: null, sets_vote: null, ou_vote: null, ou_line: null })
      .eq('match_id', matchId)
      .eq('device_id', deviceId);
  }

  async getMyActiveMatchIds(): Promise<Set<string>> {
    const deviceId = this.getDeviceId();
    const { data } = await this.supabase.client
      .from('predictions')
      .select('match_id')
      .eq('device_id', deviceId)
      .not('winner_vote', 'is', null);
    return new Set((data || []).map((r: any) => r.match_id));
  }

  async getVotePercentages(matchId: string, teamAId: string, teamBId: string): Promise<VotePercentages> {
    const { data } = await this.supabase.client
      .from('predictions')
      .select('winner_vote')
      .eq('match_id', matchId);

    if (!data || data.length === 0) return { aCount: 0, bCount: 0, total: 0 };

    // Solo contar votos activos (winner_vote no nulo)
    const valid = data.filter(r => r.winner_vote);
    const aCount = valid.filter(r => r.winner_vote === teamAId).length;
    const bCount = valid.filter(r => r.winner_vote === teamBId).length;
    return { aCount, bCount, total: valid.length };
  }

  async calculateAndSavePoints(matchId: string, match: Match): Promise<void> {
    const { data: predictions, error } = await this.supabase.client
      .from('predictions')
      .select('*')
      .eq('match_id', matchId);

    if (error || !predictions || predictions.length === 0) return;

    const sA = match.score_sets[0] || 0;
    const sB = match.score_sets[1] || 0;
    const actualWinnerId = sA > sB ? match.team_a_id : match.team_b_id;
    const actualSets = `${Math.max(sA, sB)}-${Math.min(sA, sB)}`;
    const totalPts = Array.isArray(match.point_history) ? match.point_history.length : 0;

    for (const pred of predictions) {
      let points = 0;
      const winnerCorrect = pred.winner_vote === actualWinnerId;

      if (winnerCorrect) {
        points += 1;
        // Sets solo suman si el ganador también fue correcto
        if (pred.sets_vote && pred.sets_vote === actualSets) points += 2;
      }

      // O/U es independiente del ganador
      if (pred.ou_vote && pred.ou_line != null) {
        const actualOU = totalPts > pred.ou_line ? 'over' : 'under';
        if (pred.ou_vote === actualOU) points += 1;
      }

      await this.supabase.client.from('predictions').update({ points }).eq('id', pred.id);
    }
  }
}
