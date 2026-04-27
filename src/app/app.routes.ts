import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { SorteoComponent } from './sorteo/sorteo.component';
import { MatchAdminComponent } from './match-admin/match-admin.component';
import { LiveMatchComponent } from './live-match/live-match.component';
import { StandingsComponent } from './standings/standings.component';
import { TeamsComponent } from './teams/teams.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'sorteo', component: SorteoComponent, canActivate: [adminGuard] },
  { path: 'admin/:id', component: MatchAdminComponent, canActivate: [adminGuard] },
  { path: 'live/:id', component: LiveMatchComponent },
  { path: 'standings', component: StandingsComponent },
  { path: 'teams', component: TeamsComponent },
  { path: 'leaderboard', component: LeaderboardComponent }
];
