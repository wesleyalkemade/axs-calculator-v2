import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MainComponent } from './components/main-page/main/main.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ErrorComponent } from './components/main-page/error/error.component';
import { InformationComponent } from './components/information/information.component';
import { AllLobbiesComponent } from './components/lobby/all-lobbies/all-lobbies.component';
import { CreateLobbyComponent } from './components/lobby/create-lobby/create-lobby.component';
import { LobbyViewComponent } from './components/lobby/lobby-view/lobby-view.component';
import { MappoolOverviewComponent } from './components/tournament-management/mappool/mappool-overview/mappool-overview.component';
import { MappoolCreateComponent } from './components/tournament-management/mappool/mappool-create/mappool-create.component';
import { IrcComponent } from './components/irc/irc.component';
import { RegisterComponent } from './components/register/register.component';
import { TournamentCreateComponent } from './components/tournament-management/tournament/tournament-create/tournament-create.component';
import { TournamentOverviewComponent } from './components/tournament-management/tournament/tournament-overview/tournament-overview.component';
import { TournamentEditComponent } from './components/tournament-management/tournament/tournament-edit/tournament-edit.component';
import { MyPublishedMappoolsComponent } from './components/tournament-management/mappool/my-published-mappools/my-published-mappools.component';
import { MappoolEditComponent } from './components/tournament-management/mappool/mappool-edit/mappool-edit.component';
import { MyPublishedTournamentsComponent } from './components/tournament-management/tournament/my-published-tournaments/my-published-tournaments.component';
import { ManagementRouterComponent } from './components/tournament-management/management-router/management-router.component';

const routes: Routes = [
	{
		path: '',
		component: MainComponent,
		children: [
			{ path: '', component: InformationComponent },
			{ path: 'information', component: InformationComponent },
			{ path: 'settings', component: SettingsComponent },
			{ path: 'register', component: RegisterComponent },
			{ path: 'lobby-overview', component: AllLobbiesComponent },
			{ path: 'lobby-overview/create-lobby', component: CreateLobbyComponent },
			{ path: 'lobby-overview/lobby-view/:id', component: LobbyViewComponent },
			{
				path: 'tournament-management', component: ManagementRouterComponent, children: [
					{ path: 'mappool-overview', component: MappoolOverviewComponent },
					{ path: 'mappool-create', component: MappoolCreateComponent },
					{ path: 'mappool-edit/:mappoolId/:publish', component: MappoolEditComponent },
					{ path: 'my-published-mappools', component: MyPublishedMappoolsComponent },

					{ path: 'tournament-overview', component: TournamentOverviewComponent },
					{ path: 'tournament-create', component: TournamentCreateComponent },
					{ path: 'tournament-edit/:tournamentId/:publish', component: TournamentEditComponent },
					{ path: 'my-published-tournaments', component: MyPublishedTournamentsComponent },
				]
			},
			{ path: 'irc', component: IrcComponent },
			{ path: '**', component: ErrorComponent }
		]
	}
];

@NgModule({
	imports: [RouterModule.forRoot(routes, { useHash: true })],
	exports: [RouterModule]
})

export class AppRoutingModule { }
