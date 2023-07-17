import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppConfig } from 'environments/environment';

@Injectable({
	providedIn: 'root'
})
export class WybinService {
	private readonly API_URL = AppConfig.apiUrl;

	constructor(private http: HttpClient) { }

	getMatch(tournamentId: number, stageName: string, opponentOne: string, opponentTwo: string) {
		return this.http.post(`${this.API_URL}tournament-wyreferee-match`, {
			tournamentId,
			stageName,
			opponentOne,
			opponentTwo
		});
	}

	updateMatchScore(tournamentId: number, stageName: string, multiplayerLink: string, opponentOne: string, opponentTwo: string, opponentOneScore: number, opponentTwoScore: number, winByDefaultWinner: string, opponentOneBans: number[], opponentTwoBans: number[]) {
		return this.http.post(`${this.API_URL}tournament-wyreferee-score-update`, {
			tournamentId: tournamentId,
			stageName: stageName,
			multiplayerLink: multiplayerLink,
			opponentOne: opponentOne,
			opponentTwo: opponentTwo,
			opponentOneScore: opponentOneScore,
			opponentTwoScore: opponentTwoScore,
			winByDefaultWinner: winByDefaultWinner,
			opponentOneBans: opponentOneBans,
			opponentTwoBans: opponentTwoBans
		});
	}
}
