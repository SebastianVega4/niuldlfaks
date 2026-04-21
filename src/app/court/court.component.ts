import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-court',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="court-wrapper" [class.inverted]="inverted()">
      <div class="court-container">
        <!-- SVG Court Representation -->
        <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet" class="court-svg">
          <!-- Background and Outer Lines -->
          <rect x="0" y="0" width="800" height="400" fill="var(--court-out)" />
          
          <!-- Inner Court Wood Surface -->
          <rect x="100" y="50" width="600" height="300" fill="var(--court-wood)" stroke="var(--court-lines)" stroke-width="4" />
          
          <!-- Center Line (Net) -->
          <line x1="400" y1="50" x2="400" y2="350" stroke="var(--court-lines)" stroke-width="6" />
          
          <!-- Attack Lines (3m lines) -->
          <line x1="300" y1="50" x2="300" y2="350" stroke="var(--court-lines)" stroke-width="2" stroke-dasharray="8,8" />
          <line x1="500" y1="50" x2="500" y2="350" stroke="var(--court-lines)" stroke-width="2" stroke-dasharray="8,8" />

          <!-- Left Side Players (Team A) -->
          <g *ngFor="let p of positionsTeamA(); let i = index">
            <circle [attr.cx]="getPosX(i, 'A')" [attr.cy]="getPosY(i, 'A')" r="25" 
                    [attr.fill]="(i === 0 && isServeA) ? '#fbbf24' : '#3b82f6'" 
                    [attr.stroke]="(i === 0 && isServeA) ? '#fff' : 'white'" 
                    [attr.stroke-width]="(i === 0 && isServeA) ? 4 : 2" 
                    [class.server-glow]="i === 0 && isServeA"
                    class="player-dot" />
            <text [attr.x]="getPosX(i, 'A')" [attr.y]="getPosY(i, 'A') + 40" text-anchor="middle" fill="white" font-size="12" font-weight="bold" class="player-text">
               {{ getDisplayName(p) }}
            </text>
            <text *ngIf="i === 0 && isServeA" [attr.x]="getPosX(i, 'A')" [attr.y]="getPosY(i, 'A') + 5" text-anchor="middle" fill="black" font-size="12" font-weight="900" class="player-text">
               S
            </text>
          </g>

          <!-- Right Side Players (Team B) -->
          <g *ngFor="let p of positionsTeamB(); let i = index">
            <circle [attr.cx]="getPosX(i, 'B')" [attr.cy]="getPosY(i, 'B')" r="25" 
                    [attr.fill]="(i === 0 && isServeB) ? '#fbbf24' : '#f43f5e'" 
                    [attr.stroke]="(i === 0 && isServeB) ? '#fff' : 'white'" 
                    [attr.stroke-width]="(i === 0 && isServeB) ? 4 : 2"
                    [class.server-glow]="i === 0 && isServeB"
                    class="player-dot" />
            <text [attr.x]="getPosX(i, 'B')" [attr.y]="getPosY(i, 'B') + 40" text-anchor="middle" fill="white" font-size="12" font-weight="bold" class="player-text">
               {{ getDisplayName(p) }}
            </text>
            <text *ngIf="i === 0 && isServeB" [attr.x]="getPosX(i, 'B')" [attr.y]="getPosY(i, 'B') + 5" text-anchor="middle" fill="black" font-size="12" font-weight="900" class="player-text">
               S
            </text>
          </g>
        </svg>

        <button *ngIf="showInversionControl" (click)="toggleInversion()" class="btn btn-secondary inversion-btn" title="Rotar Visión">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/></svg>
           Invertir Cancha
        </button>
      </div>
    </div>
  `,
  styles: [`
    .court-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
      transition: transform 0.6s ease-in-out;
    }
    .court-wrapper.inverted {
      transform: rotate(180deg);
    }
    .court-wrapper.inverted .player-text {
      transform-origin: center;
      transform-box: fill-box;
      transform: rotate(180deg);
    }
    .court-wrapper.inverted .inversion-btn {
      transform: rotate(180deg);
      bottom: auto;
      top: -50px;
    }
    .court-container {
      position: relative;
      width: 100%;
      max-width: 800px;
      margin: 2rem 0;
      border-radius: 8px;
      overflow: visible;
      box-shadow: var(--glass-shadow);
      border: 3px solid var(--border-color);
    }
    .court-svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .player-dot {
      transition: all 0.5s ease-out;
      filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.5));
    }
    .server-glow {
      filter: drop-shadow(0 0 10px #fbbf24);
      animation: pulse-server 1.5s infinite;
    }
    @keyframes pulse-server {
      0% { r: 25; }
      50% { r: 28; }
      100% { r: 25; }
    }
    .inversion-btn {
      position: absolute;
      bottom: -50px;
      right: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-secondary);
      transition: transform 0.3s;
    }
  `]
})
export class CourtComponent {
  @Input() set teamA(val: string[]) { this.positionsTeamA.set(val); }
  @Input() set teamB(val: string[]) { this.positionsTeamB.set(val); }
  @Input() mode: number = 6;
  @Input() sideSwapped: boolean = false;
  @Input() isServeA: boolean = false;
  @Input() isServeB: boolean = false;
  @Input() showInversionControl: boolean = true;

  positionsTeamA = signal<string[]>([]);
  positionsTeamB = signal<string[]>([]);
  inverted = signal(false);

  toggleInversion() {
    this.inverted.update(v => !v);
  }

  getDisplayName(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return name;
  }

  getPosX(index: number, team: 'A' | 'B'): number {
    const isTeamALeft = (team === 'A' && !this.sideSwapped) || (team === 'B' && this.sideSwapped);
    
    if (this.mode === 6) {
      const isFront = index === 1 || index === 2 || index === 3;
      return isTeamALeft ? (isFront ? 330 : 170) : (isFront ? 470 : 630);
    } else if (this.mode === 4) { // Diamond: 0:Back, 1:Right, 2:Front, 3:Left
      if (index === 0) return isTeamALeft ? 150 : 650; // Back further
      if (index === 2) return isTeamALeft ? 350 : 450; // Front closer
      return isTeamALeft ? 250 : 550; // Sides
    } else { // 3x3 Triangle: 0:Back, 1:RightFront, 2:LeftFront
      if (index === 0) return isTeamALeft ? 170 : 630;
      return isTeamALeft ? 330 : 470;
    }
  }

  getPosY(index: number, team: 'A' | 'B'): number {
    const isTeamALeft = (team === 'A' && !this.sideSwapped) || (team === 'B' && this.sideSwapped);
    
    if (this.mode === 6) {
      const mapY: any = isTeamALeft ? { 0:300, 1:300, 2:200, 3:100, 4:100, 5:200 } : { 0:100, 1:100, 2:200, 3:300, 4:300, 5:200 };
      return mapY[index] || 200;
    } else if (this.mode === 4) { // Diamond: 0:Back, 1:Right, 2:Front, 3:Left
      if (index === 0 || index === 2) return 200; // Center axis
      // Para el equipo de la izquierda, la derecha es abajo (300). 
      // Para el equipo de la derecha, la derecha es arriba (100).
      if (isTeamALeft) {
        return index === 1 ? 300 : 100; // 1:Right(Bottom), 3:Left(Top)
      } else {
        return index === 1 ? 100 : 300; // 1:Right(Top), 3:Left(Bottom)
      }
    } else { // 3x3 Triangle: 0:Back, 1:RightFront, 2:LeftFront
      if (index === 0) return 200;
      if (isTeamALeft) {
        return index === 1 ? 300 : 100;
      } else {
        return index === 1 ? 100 : 300;
      }
    }
  }
}
