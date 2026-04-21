import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../core/services/supabase.service';

interface DraftPlayer {
  name: string;
  isLeader: boolean;
}

@Component({
  selector: 'app-sorteo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sorteo.component.html',
  styleUrls: ['./sorteo.component.scss']
})
export class SorteoComponent {
  private supabase = inject(SupabaseService);

  // Validation state
  duplicates = signal<string[]>([]);
  showConfirmation = signal(false);
  
  // Selection state
  players = signal<DraftPlayer[]>([]);
  searchQuery = signal('');
  gameMode = signal<number>(6); // Default 6x6
  
  // Computed
  filteredPlayers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.players().filter(p => p.name.toLowerCase().includes(q));
  });

  selectedLeadersCount = computed(() => this.players().filter(p => p.isLeader).length);

  // New Validation computed
  validationMessage = computed(() => {
    const total = this.players().length;
    const leaders = this.selectedLeadersCount();
    if (leaders < 2) return 'Se requieren al menos 2 líderes.';
    
    const mode = this.gameMode();
    const capacity = leaders * mode;
    const isPerfect = (total % leaders === 0) && (total / leaders === mode);
    
    if (!isPerfect) {
      return `Advertencia: Los equipos no están completos. Se esperan ${mode} jugadores por equipo (${capacity} total), pero hay ${total} jugadores. ¿Desea continuar?`;
    }
    
    return null;
  });

  isImbalanced = computed(() => {
    const total = this.players().length;
    const leaders = this.selectedLeadersCount();
    if (leaders < 2) return false;
    const mode = this.gameMode();
    return (total % leaders !== 0) || (total / leaders !== mode);
  });

  // Draft state
  isDrafting = signal(false);
  draftComplete = signal(false);
  draftError = signal<string | null>(null);

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseNames(text);
    };
    reader.readAsText(file);
  }

  parseNames(text: string) {
    const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
    
    // Check duplicates
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      const sortedNames = [...names].sort();
      const dups = [];
      for (let i = 0; i < sortedNames.length - 1; i++) {
        if (sortedNames[i + 1] === sortedNames[i]) {
          dups.push(sortedNames[i]);
        }
      }
      this.duplicates.set([...new Set(dups)]);
      this.players.set(names.map(n => ({ name: n, isLeader: false })));
      this.showConfirmation.set(false);
    } else {
      this.duplicates.set([]);
      this.players.set(names.map(n => ({ name: n, isLeader: false })));
      this.showConfirmation.set(true);
    }
  }

  removeDuplicate(name: string) {
    const current = this.players();
    const idx = current.findIndex(p => p.name === name);
    if (idx > -1) {
      current.splice(idx, 1);
      this.players.set([...current]);
      
      const namesOnly = current.map(c => c.name);
      if (namesOnly.length === new Set(namesOnly).size) {
         this.duplicates.set([]);
         this.showConfirmation.set(true);
      }
    }
  }

  toggleLeader(player: DraftPlayer) {
    this.players.update(list => {
      const found = list.find(p => p.name === player.name);
      if (found) found.isLeader = !found.isLeader;
      return [...list];
    });
  }

  async startDraft() {
    if (this.selectedLeadersCount() < 2) {
       alert('Se requieren al menos 2 líderes.');
       return;
    }

    if (this.isImbalanced()) {
      if (confirm(this.validationMessage()!)) {
        await this.execDraft();
      }
    } else {
      await this.execDraft();
    }
  }

  async execDraft() {
    this.isDrafting.set(true);
    
    // Separate leaders and the rest
    const leadersList = this.players().filter(p => p.isLeader).map(p => p.name);
    let restOfPlayers = this.players().filter(p => !p.isLeader).map(p => p.name);
    
    // Fisher-Yates shuffle for the rest
    for (let i = restOfPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [restOfPlayers[i], restOfPlayers[j]] = [restOfPlayers[j], restOfPlayers[i]];
    }
    
    const teamsData = [];
    
    // Divide leaders into Group A and B
    for (let i = 0; i < leadersList.length; i++) {
        const leader = leadersList[i];
        const group = (i % 2 === 0) ? 'A' : 'B';
        const teamName = `Equipo ${leader}`;
        const tempTeam = {
            name: teamName,
            group: group,
            stats: { sets_ganados: 0, puntos_total: 0, diferencia: 0 }
        };
        const tempPlayers = [{ name: leader, is_leader: true }];
        teamsData.push({ team: tempTeam, players: tempPlayers });
    }
    
    // Distribute remaining
    const leadersCount = teamsData.length;
    for (let i = 0; i < restOfPlayers.length; i++) {
        const teamIdx = i % leadersCount;
        teamsData[teamIdx].players.push({ name: restOfPlayers[i], is_leader: false });
    }
    
    const result = await this.supabase.saveDraft(teamsData);
    
    if (result.success && result.teamIds) {
      // Generate matches within groups
      await this.generateGroupMatches(teamsData, result.teamIds);
      this.draftComplete.set(true);
      this.draftError.set(null);
    } else {
      this.draftError.set(result.error || 'Error desconocido');
    }
    this.isDrafting.set(false);
  }

  async generateGroupMatches(teamsData: any[], createdIds: string[]) {
    const matches = [];
    const groupA: string[] = [];
    const groupB: string[] = [];
    
    for (let i = 0; i < teamsData.length; i++) {
      if (teamsData[i].team.group === 'A') {
        groupA.push(createdIds[i]);
      } else {
        groupB.push(createdIds[i]);
      }
    }
    
    // Intra-group matches for A
    for (let i = 0; i < groupA.length; i++) {
      for (let j = i + 1; j < groupA.length; j++) {
        matches.push(this.createMatchObject(groupA[i], groupA[j]));
      }
    }
    
    // Intra-group matches for B
    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        matches.push(this.createMatchObject(groupB[i], groupB[j]));
      }
    }

    if (matches.length > 0) {
      const { error } = await this.supabase.client.from('matches').insert(matches);
      if (error) console.error('Error generating matches', error);
    }
  }

  private createMatchObject(id1: string, id2: string) {
    return {
      team_a_id: id1,
      team_b_id: id2,
      status: 'scheduled',
      game_mode: this.gameMode(),
      score_sets: [0, 0],
      current_set_score: [0, 0],
      point_history: [],
      rotation_state: { 
        team_a: [], 
        team_b: [] 
      },
      round: 'group',
      bracket_position: 'group_match'
    };
  }
}
