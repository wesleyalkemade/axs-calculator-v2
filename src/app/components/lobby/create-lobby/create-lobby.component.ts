import { Component, OnInit } from '@angular/core';
import { ToastService } from '../../../services/toast.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { IrcService } from '../../../services/irc.service';
import { ScoreInterface } from '../../../models/score-calculation/calculation-types/score-interface';
import { Calculate } from '../../../models/score-calculation/calculate';
import { TournamentService } from '../../../services/tournament.service';
import { MatSelectChange } from '@angular/material/select';
import { Router } from '@angular/router';
import { from, Observable } from 'rxjs';
import { BanchoMultiplayerChannel } from 'bancho.js';
import { OsuHelper } from 'app/models/osu-models/osu';
import { WyTournament } from 'app/models/wytournament/wy-tournament';
import { WyTeam } from 'app/models/wytournament/wy-team';
import { map, startWith } from 'rxjs/operators';
import { Lobby } from 'app/models/lobby';
import { WyMultiplayerLobbiesService } from 'app/services/wy-multiplayer-lobbies.service';

@Component({
	selector: 'app-create-lobby',
	templateUrl: './create-lobby.component.html',
	styleUrls: ['./create-lobby.component.scss']
})

export class CreateLobbyComponent implements OnInit {
	teamOneName: string;
	teamTwoName: string;
	multiplayerLobby: string;
	tournamentAcronym: string;
	matchDescription: string;
	selectedTournament: WyTournament;
	teamSize: number;
	selectedScoreInterface: ScoreInterface;

	validationForm: FormGroup;
	lobbyHasBeenCreated = false;

	ircAuthenticated = false;

	calculateScoreInterfaces: Calculate;

	teamOneArray: number[] = [];
	teamTwoArray: number[] = [];

	challongeMatches: ChallongeMatch[] = [];
	checkingChallongeIntegration = false;

	teamOneFilter: Observable<WyTeam[]>;
	teamTwoFilter: Observable<WyTeam[]>;

	constructor(
		private multiplayerLobbies: WyMultiplayerLobbiesService,
		private toastService: ToastService,
		private ircService: IrcService,
		public tournamentService: TournamentService,
		private router: Router) {
		this.calculateScoreInterfaces = new Calculate();

		ircService.getIsAuthenticated().subscribe(isAuthenticated => {
			this.ircAuthenticated = isAuthenticated;
		});

		this.validationForm = new FormGroup({
			'multiplayer-link': new FormControl('', [
				Validators.pattern(/https:\/\/osu.ppy.sh\/community\/matches\/[0-9]+/)
			]),
			'tournament-acronym': new FormControl('', [
				Validators.required,
				Validators.maxLength(10)
			]),
			'score-interface': new FormControl('', [
				Validators.required
			]),
			'team-size': new FormControl('', [
				Validators.required,
				Validators.min(1),
				Validators.max(8),
				Validators.pattern(/^\d+$/)
			]),
			'team-one-name': new FormControl('', [
				Validators.required
			]),
			'team-two-name': new FormControl('', [
				Validators.required
			]),
			'webhook': new FormControl(),
			'selected-tournament': new FormControl()
		});

		this.teamOneFilter = this.validationForm.get('team-one-name').valueChanges.pipe(
			startWith(''),
			map((value) => {
				const filterValue = value.toLowerCase();
				return this.selectedTournament.teams.filter(option => option.name.toLowerCase().includes(filterValue));
			})
		);

		this.teamTwoFilter = this.validationForm.get('team-two-name').valueChanges.pipe(
			startWith(''),
			map((value) => {
				const filterValue = value.toLowerCase();
				return this.selectedTournament.teams.filter(option => option.name.toLowerCase().includes(filterValue));
			})
		)
	}

	ngOnInit() { }

	changeTournament() {
		// TODO: fix this
		this.selectedTournament = this.tournamentService.getTournamentById(this.validationForm.get('selected-tournament').value);
		this.changeTeamSize(this.selectedTournament != null ? this.selectedTournament.teamSize : null);

		this.selectedScoreInterface = this.calculateScoreInterfaces.getScoreInterface(this.selectedTournament ? this.selectedTournament.scoreInterfaceIdentifier : null);
		this.teamSize = this.selectedScoreInterface ? this.selectedScoreInterface.getTeamSize() : null;
		this.validationForm.get('team-size').setValue(this.selectedTournament != null ? this.selectedTournament.teamSize : this.teamSize);
		this.validationForm.get('tournament-acronym').setValue(this.selectedTournament != null ? this.selectedTournament.acronym : null);
		this.validationForm.get('score-interface').setValue(this.selectedScoreInterface ? this.selectedScoreInterface.getIdentifier() : null);

		// Make sure to reset challonge matches
		this.challongeMatches = [];

		this.validationForm.addControl('team-one-name', new FormControl('', Validators.required));
		this.validationForm.addControl('team-two-name', new FormControl('', Validators.required));

		this.validationForm.removeControl('challonge-match');
		this.validationForm.removeControl('challonge-tournament');

		// this.checkingChallongeIntegration = true;

		// this.challongeService.getChallongeMatchups(this.selectedTournament).subscribe((result: any) => {
		// 	if (result == null) {
		// 		this.checkingChallongeIntegration = false;
		// 		return;
		// 	}

		// 	// TODO: add check for Group stage matches, ignore those
		// 	// this.challongeMatches = this.challongeService.parseChallongeEndpoint(result);

		// 	if (this.challongeMatches.length > 0) {
		// 		this.challongeMatches.sort((firstMatch, secondMatch) => firstMatch.suggested_play_order - secondMatch.suggested_play_order);

		// 		this.validationForm.removeControl('team-one-name');
		// 		this.validationForm.removeControl('team-two-name');

		// 		this.validationForm.addControl('challonge-match', new FormControl('', Validators.required));
		// 		this.validationForm.addControl('challonge-tournament', new FormControl());
		// 	}

		// 	this.checkingChallongeIntegration = false;
		// }, () => {
		// 	this.checkingChallongeIntegration = false;
		// });
	}

	changeScoreInterface(event: MatSelectChange) {
		this.selectedScoreInterface = this.calculateScoreInterfaces.getScoreInterface(event.value);

		this.teamSize = this.selectedScoreInterface.getTeamSize();
		this.validationForm.get('team-size').setValue(this.teamSize);
	}

	changeChallongeMatch(event: MatSelectChange) {
		const match = this.challongeMatches.find(match => match.id == event.value);

		this.validationForm.get('challonge-match').setValue(match.id);
		this.validationForm.get('challonge-tournament').setValue(match.tournament_id);
	}

	createLobby() {
		if (this.validationForm.valid) {
			const lobby = new Lobby({
				lobbyId: this.multiplayerLobbies.availableLobbyId,
				teamSize: this.validationForm.get('team-size').value,
				multiplayerLink: this.validationForm.get('multiplayer-link').value,
				tournamentId: this.selectedTournament != null ? this.selectedTournament.id : null,
				tournament: this.selectedTournament,
				webhook: this.validationForm.get('webhook').value,
				teamOneName: this.validationForm.get('team-one-name').value,
				teamTwoName: this.validationForm.get('team-two-name').value
			});

			lobby.description = `${lobby.teamOneName} vs ${lobby.teamTwoName}`;

			this.ircService.isCreatingMultiplayerLobby = lobby.lobbyId;

			// Multiplayer link was not found, create new lobby
			if (lobby.multiplayerLink == '') {
				from(this.ircService.client.createLobby(`${lobby.tournament.acronym}: ${lobby.teamOneName} vs ${lobby.teamTwoName}`)).subscribe((multiplayerChannel: BanchoMultiplayerChannel) => {
					this.ircService.joinChannel(multiplayerChannel.name);
					this.ircService.initializeChannelListeners(multiplayerChannel);

					this.lobbyHasBeenCreatedTrigger();

					lobby.multiplayerLink = `https://osu.ppy.sh/community/matches/${multiplayerChannel.lobby.id}`;

					this.multiplayerLobbies.addMultiplayerLobby(lobby);

					this.toastService.addToast(`Successfully created the multiplayer lobby ${lobby.description}!`);

					this.router.navigate(['lobby-overview/lobby-view', lobby.lobbyId]);
				});
			}
			// Multiplayer link was found, attempt to join lobby
			else {
				const multiplayerId = OsuHelper.getMultiplayerIdFromLink(lobby.multiplayerLink);
				const multiplayerChannel = this.ircService.client.getChannel(`#mp_${multiplayerId}`) as BanchoMultiplayerChannel;

				from(multiplayerChannel.join()).subscribe(() => {
					this.ircService.joinChannel(multiplayerChannel.name);
					this.ircService.initializeChannelListeners(multiplayerChannel);

					this.lobbyHasBeenCreatedTrigger();

					this.multiplayerLobbies.addMultiplayerLobby(lobby);

					this.toastService.addToast(`Successfully joined the multiplayer lobby ${multiplayerChannel.name}!`);

					this.router.navigate(['lobby-overview/lobby-view', lobby.lobbyId]);
				}, () => {
					this.lobbyHasBeenCreatedTrigger();
					this.multiplayerLobbies.addMultiplayerLobby(lobby);

					this.toastService.addToast(`Successfully joined the multiplayer lobby ${multiplayerChannel.name}! Unable to connect to the irc channel, lobby is most likely closed already.`);

					this.router.navigate(['lobby-overview/lobby-view', lobby.lobbyId]);
				});
			}
		}
		else {
			this.validationForm.markAllAsTouched();
		}
	}

	lobbyHasBeenCreatedTrigger() {
		this.lobbyHasBeenCreated = true;

		setTimeout(() => {
			this.lobbyHasBeenCreated = false;
		}, 3000);
	}

	getValidation(key: string): any {
		return this.validationForm.get(key);
	}

	changeTeamSize(teamSize?: number) {
		this.teamOneArray = [];
		this.teamTwoArray = [];

		let teamSizeVal: any;

		if (teamSize == null || teamSize == undefined) {
			teamSizeVal = parseInt(this.getValidation('team-size').value >= 8 ? 8 : this.getValidation('team-size').value);
		}
		else {
			teamSizeVal = teamSize >= 8 ? 8 : teamSize;
		}

		teamSizeVal = parseInt(teamSizeVal);

		for (let i = 1; i < (teamSizeVal + 1); i++) {
			this.teamOneArray.push(i);
		}

		for (let i = teamSizeVal + 1; i < ((teamSizeVal * 2) + 1); i++) {
			this.teamTwoArray.push(i);
		}
	}
}
