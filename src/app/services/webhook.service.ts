import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CacheService } from './cache.service';
import { MultiplayerDataUser } from '../models/store-multiplayer/multiplayer-data-user';
import { Lobby } from 'app/models/lobby';
import { WyModBracketMap } from 'app/models/wytournament/mappool/wy-mod-bracket-map';
import { ToastService } from './toast.service';
import { StoreService } from './store.service';

@Injectable({
	providedIn: 'root'
})
export class WebhookService {
	authorImage: string;
	authorName: string;
	bottomImage: string;
	footerIconUrl: string;
	footerText: string;

	constructor(private http: HttpClient, private cacheService: CacheService, private toastService: ToastService, private storeService: StoreService) {
		const webhookStore = this.storeService.get('webhook');

		if (webhookStore !== undefined) {
			this.authorImage = webhookStore.authorImage;
			this.authorName = webhookStore.authorName;
			this.bottomImage = webhookStore.bottomImage;
			this.footerIconUrl = webhookStore.footerIconUrl;
			this.footerText = webhookStore.footerText;
		}
	}

	/**
	 * Update the webhook customizations
	 */
	updateWebhookCustomization(authorImage: string, authorName: string, bottomImage: string, footerIconUrl: string, footerText: string): void {
		const isUndefined = ['', null, undefined];

		if (!isUndefined.includes(authorImage)) {
			this.storeService.set('webhook.authorImage', authorImage);
			this.authorImage = authorImage;
		}
		else {
			this.authorImage = null;
		}

		if (!isUndefined.includes(authorName)) {
			this.storeService.set('webhook.authorName', authorName);
			this.authorName = authorName;
		}
		else {
			this.authorName = null;
		}

		if (!isUndefined.includes(bottomImage)) {
			this.storeService.set('webhook.bottomImage', bottomImage);
			this.bottomImage = bottomImage;
		}
		else {
			this.bottomImage = null;
		}

		if (!isUndefined.includes(footerIconUrl)) {
			this.storeService.set('webhook.footerIconUrl', footerIconUrl);
			this.footerIconUrl = footerIconUrl;
		}
		else {
			this.footerIconUrl = null;
		}

		if (!isUndefined.includes(footerText)) {
			this.storeService.set('webhook.footerText', footerText);
			this.footerText = footerText;
		}
		else {
			this.footerText = null;
		}
	}

	/**
	 * Send final result to discord through a webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param extraMessage the extra message
	 * @param referee the referee
	 */
	sendFinalResult(selectedLobby: Lobby, extraMessage: string, referee: string) {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		const scoreString = (selectedLobby.getTeamOneScore() > selectedLobby.getTeamTwoScore()) ?
			`**Score:** __${selectedLobby.teamOneName}__ | **${selectedLobby.getTeamOneScore()}** - ${selectedLobby.getTeamTwoScore()} | ${selectedLobby.teamTwoName}` :
			`**Score:** ${selectedLobby.teamOneName} | ${selectedLobby.getTeamOneScore()} - **${selectedLobby.getTeamTwoScore()}** | __${selectedLobby.teamTwoName}__`;

		const body = {
			embeds: [
				{
					title: `${selectedLobby.selectedStage.name}: **${selectedLobby.teamOneName}** vs **${selectedLobby.teamTwoName}**`,
					url: selectedLobby.multiplayerLink,
					description: `${scoreString} \n\n**First pick**: ${selectedLobby.firstPick} \n\n${selectedLobby.multiplayerLink}`,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					fields: [
					]
				}
			]
		};

		const teamOneBans: any[] = [];
		const teamTwoBans: any[] = [];

		if (selectedLobby.teamOneBans.length > 0) {
			for (const ban of selectedLobby.teamOneBans) {
				for (const modBracket of selectedLobby.mappool.modBrackets) {
					for (const beatmap of modBracket.beatmaps) {
						if (beatmap.beatmapId == ban) {
							teamOneBans.push(`[${beatmap.beatmapName}](${beatmap.beatmapUrl})`);
						}
					}
				}
			}

			body.embeds[0].fields.push({
				name: `**${selectedLobby.teamOneName}** bans:`,
				value: teamOneBans.join('\n'),
				inline: true
			});

		}

		if (selectedLobby.teamTwoBans.length > 0) {
			for (const ban of selectedLobby.teamTwoBans) {
				for (const modBracket of selectedLobby.mappool.modBrackets) {
					for (const beatmap of modBracket.beatmaps) {
						if (beatmap.beatmapId == ban) {
							teamTwoBans.push(`[${beatmap.beatmapName}](${beatmap.beatmapUrl})`);
						}
					}
				}
			}

			body.embeds[0].fields.push({
				name: `**${selectedLobby.teamTwoName}** bans:`,
				value: teamTwoBans.join('\n'),
				inline: true
			});
		}

		if (extraMessage != null) {
			body.embeds[0].fields.push({
				name: `**Additional message by ${referee}**`,
				value: extraMessage,
			});
		}

		this.setCustomizedFields(body, true);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.finalResult == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe(() => {
					this.toastService.addToast('Successfully send the message to Discord.');
				});
			}
		}
	}

	/**
	 * Send win by default message to discord through a webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param extraMessage the extra message
	 * @param wbdWinningTeam the team that has the win
	 * @param wbdLosingTeam the team that has the loss
	 * @param referee the referee
	 */
	sendWinByDefaultResult(selectedLobby: Lobby, extraMessage: string, wbdWinningTeam: string, wbdLosingTeam: string, referee: string) {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		let resultDescription = `**Score:** __${wbdWinningTeam}__ | 1 - 0 | ${wbdLosingTeam} \n\n__${wbdLosingTeam}__ failed to show up.`;

		if (wbdWinningTeam == 'no-one') {
			resultDescription = `**Score:** ${selectedLobby.teamOneName} | 0 - 0 | ${selectedLobby.teamTwoName} \n\nBoth __${selectedLobby.teamOneName}__ and __${selectedLobby.teamTwoName}__ failed to show up.`;
		}

		const body = {
			embeds: [
				{
					title: `${selectedLobby.selectedStage.name}: **${selectedLobby.teamOneName}** vs **${selectedLobby.teamTwoName}**`,
					description: resultDescription,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					fields: [
					]
				}
			]
		};

		if (extraMessage != null) {
			body.embeds[0].fields.push({
				name: `**Additional message by ${referee}**`,
				value: extraMessage,
			});
		}

		this.setCustomizedFields(body, false);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.finalResult == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe(() => {
					this.toastService.addToast('Successfully send the message to Discord.');
				});
			}
		}
	}

	/**
	 * Send qualifier lobby message to discord through a webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param extraMessage the extra message
	 * @param referee the referee
	 */
	sendQualifierResult(selectedLobby: Lobby, extraMessage: string, referee: string) {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		const body = {
			embeds: [
				{
					title: selectedLobby.getQualifierName(),
					description: '',
					url: selectedLobby.multiplayerLink,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					fields: [
					]
				}
			]
		};

		if (extraMessage != null) {
			body.embeds[0].fields.push({
				name: `**Additional message by ${referee}**`,
				value: extraMessage,
			});
		}

		this.setCustomizedFields(body, true);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.finalResult == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe(() => {
					this.toastService.addToast('Successfully send the message to Discord.');
				});
			}
		}
	}

	/**
	 * Send the ban through a discord webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param teamName the name of the banner
	 * @param ban the map that was banned
	 * @param referee the referee
	 */
	sendBanResult(selectedLobby: Lobby, teamName: string, ban: WyModBracketMap, referee: string) {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		const body = {
			embeds: [
				{
					title: `🔨 Ban update - ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}`,
					url: selectedLobby.multiplayerLink,
					description: `**${teamName}** has banned [**${ban.beatmapName}**](${ban.beatmapUrl})`,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					thumbnail: {
						url: `https://b.ppy.sh/thumb/${ban.beatmapsetId}.jpg`
					},
					fields: [
					]
				}
			]
		};

		this.setCustomizedFields(body, false);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.bans == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe();
			}
		}
	}

	/**
	 * Send the protect through a discord webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param teamName the name of the banner
	 * @param protect the map that was protected
	 * @param referee the referee
	 */
	sendProtectResult(selectedLobby: Lobby, teamName: string, protect: WyModBracketMap, referee: string) {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		const body = {
			embeds: [
				{
					title: `🛡 Protect update - ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}`,
					url: selectedLobby.multiplayerLink,
					description: `**${teamName}** has protected [**${protect.beatmapName}**](${protect.beatmapUrl})`,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					thumbnail: {
						url: `https://b.ppy.sh/thumb/${protect.beatmapsetId}.jpg`
					},
					fields: [
					]
				}
			]
		};

		this.setCustomizedFields(body, false);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.bans == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe();
			}
		}
	}

	/**
	 * Send a summary of the match through a discord webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param referee the referee that is running the lobby
	 */
	sendMatchSummary(selectedLobby: Lobby, referee: string) {
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		const teamOneBans = [];
		const teamTwoBans = [];

		for (const ban of selectedLobby.teamOneBans) {
			teamOneBans.push(selectedLobby.tournament.getBeatmapForMatchSummary(ban));
		}

		for (const ban of selectedLobby.teamTwoBans) {
			teamTwoBans.push(selectedLobby.tournament.getBeatmapForMatchSummary(ban));
		}

		const firstPickTeam = selectedLobby.firstPick == selectedLobby.teamOneName ? 1 : 2;
		const teamOneLength = selectedLobby.teamOnePicks.length;
		const teamTwoLength = selectedLobby.teamTwoPicks.length;
		const maxLength = Math.max(teamOneLength, teamTwoLength);

		const picks: string[] = [];

		for (let i = 0; i < maxLength; i++) {
			if (firstPickTeam === 1) {
				if (i < teamOneLength) {
					const teamOnePick = selectedLobby.teamOnePicks[i];
					picks.push(`${selectedLobby.tournament.getBeatmapForMatchSummary(teamOnePick)} was picked by **${selectedLobby.teamOneName}**`);
				}
				if (i < teamTwoLength) {
					const teamTwoPick = selectedLobby.teamTwoPicks[i];
					picks.push(`${selectedLobby.tournament.getBeatmapForMatchSummary(teamTwoPick)} was picked by **${selectedLobby.teamTwoName}**`);
				}
			} else if (firstPickTeam === 2) {
				if (i < teamTwoLength) {
					const teamTwoPick = selectedLobby.teamTwoPicks[i];
					picks.push(`${selectedLobby.tournament.getBeatmapForMatchSummary(teamTwoPick)} was picked by **${selectedLobby.teamTwoName}**`);
				}
				if (i < teamOneLength) {
					const teamOnePick = selectedLobby.teamOnePicks[i];
					picks.push(`${selectedLobby.tournament.getBeatmapForMatchSummary(teamOnePick)} was picked by **${selectedLobby.teamOneName}**`);
				}
			}
		}

		const body = {
			embeds: [
				{
					title: `Match summary - ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}`,
					url: selectedLobby.multiplayerLink,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					fields: [
					]
				}
			]
		};

		body.embeds[0].fields.push(
			{
				name: `${selectedLobby.teamOneName} bans`,
				value: teamOneBans.join('\n'),
				inline: true
			},
			{
				name: `${selectedLobby.teamTwoName} bans`,
				value: teamTwoBans.join('\n'),
				inline: true
			});

		body.embeds[0].fields.push(
			{
				name: 'Match picks',
				value: picks.join('\n')
			});

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.matchSummary == true) {
				console.log('found webhook, sending');
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe();
			}
		}
	}

	/**
	 * Send the result of the last played beatmap to a discord webhook
	 *
	 * @param multiplayerLobby the lobby to get the data from
	 * @param referee the referee
	 */
	sendMatchFinishedResult(multiplayerLobby: Lobby, referee: string) {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(multiplayerLobby)) {
			return;
		}

		const lastMultiplayerData = multiplayerLobby.multiplayerData[multiplayerLobby.multiplayerData.length - 1];

		let foundBeatmap: WyModBracketMap = null;

		for (const mappool of multiplayerLobby.tournament.mappools) {
			for (const modBracket of mappool.modBrackets) {
				for (const beatmap of modBracket.beatmaps) {
					if (beatmap.beatmapId == lastMultiplayerData.beatmap_id) {
						foundBeatmap = WyModBracketMap.makeTrueCopy(beatmap);

						break;
					}
				}
			}
		}

		// Map is a warmup map most likely, skip
		if (foundBeatmap == null) {
			return;
		}

		let resultString = '';
		let embedHeader = '';
		let lostTheirPick = false;

		let isReverseScoreBeatMap = false;

		if (multiplayerLobby.tournament && multiplayerLobby.mappool) {
			for (const modBracket of multiplayerLobby.mappool.modBrackets) {
				for (const beatmap of modBracket.beatmaps) {
					if (beatmap.beatmapId == foundBeatmap.beatmapId && foundBeatmap.reverseScore == true) {
						isReverseScoreBeatMap = true;
						break;
					}
				}
			}
		}

		// The pick was from team two
		if (multiplayerLobby.getNextPick() == multiplayerLobby.teamOneName) {
			embedHeader += `${multiplayerLobby.teamTwoName} `;

			if (isReverseScoreBeatMap == true) {
				// Team two has won their pick
				if (lastMultiplayerData.team_one_score > lastMultiplayerData.team_two_score) {
					embedHeader += `won their pick by ${lastMultiplayerData.team_one_score - lastMultiplayerData.team_two_score} points`;
					lostTheirPick = false;
				}
				// Team two has lost their pick
				else {
					embedHeader += `lost their pick by ${lastMultiplayerData.team_two_score - lastMultiplayerData.team_one_score} points`;
					lostTheirPick = true;
				}
			}
			else {
				// Team two has won their pick
				if (lastMultiplayerData.team_two_score > lastMultiplayerData.team_one_score) {
					embedHeader += `won their pick by ${lastMultiplayerData.team_two_score - lastMultiplayerData.team_one_score} points`;
					lostTheirPick = false;
				}
				// Team two has lost their pick
				else {
					embedHeader += `lost their pick by ${lastMultiplayerData.team_one_score - lastMultiplayerData.team_two_score} points`;
					lostTheirPick = true;
				}
			}
		}
		// The pick was from team one
		else {
			embedHeader += `${multiplayerLobby.teamOneName} `;

			if (isReverseScoreBeatMap == true) {
				// Team one has won their pick
				if (lastMultiplayerData.team_two_score > lastMultiplayerData.team_one_score) {
					embedHeader += `won their pick by ${lastMultiplayerData.team_two_score - lastMultiplayerData.team_one_score} points`;
					lostTheirPick = false;
				}
				// Team one has lost their pick
				else {
					embedHeader += `lost their pick by ${lastMultiplayerData.team_one_score - lastMultiplayerData.team_two_score} points`;
					lostTheirPick = true;
				}
			}
			else {
				// Team one has won their pick
				if (lastMultiplayerData.team_one_score > lastMultiplayerData.team_two_score) {
					embedHeader += `won their pick by ${lastMultiplayerData.team_one_score - lastMultiplayerData.team_two_score} points`;
					lostTheirPick = false;
				}
				// Team one has lost their pick
				else {
					embedHeader += `lost their pick by ${lastMultiplayerData.team_two_score - lastMultiplayerData.team_one_score} points`;
					lostTheirPick = true;
				}
			}
		}

		resultString += `[**${foundBeatmap.beatmapName}**](${foundBeatmap.beatmapUrl})\n\n`;

		let winner = null;

		if (isReverseScoreBeatMap == true) {
			winner = multiplayerLobby.getTeamTwoScore() > multiplayerLobby.getTeamOneScore() ? 1 : 2;
		}
		else {
			winner = multiplayerLobby.getTeamOneScore() > multiplayerLobby.getTeamTwoScore() ? 1 : 2;
		}

		resultString += (winner == 1) ?
			`**Score:** __${multiplayerLobby.teamOneName}__ | **${multiplayerLobby.getTeamOneScore()}** - ${multiplayerLobby.getTeamTwoScore()} | ${multiplayerLobby.teamTwoName}\n\n` :
			`**Score:** ${multiplayerLobby.teamOneName} | ${multiplayerLobby.getTeamOneScore()} - **${multiplayerLobby.getTeamTwoScore()}** | __${multiplayerLobby.teamTwoName}__\n\n`;

		let highestScorePlayer: MultiplayerDataUser = new MultiplayerDataUser();
		let highestAccuracyPlayer: MultiplayerDataUser = new MultiplayerDataUser();

		for (const user of lastMultiplayerData.getPlayers()) {
			if (user != null && user != undefined) {
				// Cast score and accuracy to actual int and float to prevent string comparison
				user.score = parseInt(user.score as any);
				user.accuracy = parseFloat(user.accuracy as any);

				if (user.score > highestScorePlayer.score) {
					highestScorePlayer = user;
				}

				if (user.accuracy > highestAccuracyPlayer.accuracy) {
					highestAccuracyPlayer = user;
				}
			}
		}

		const highestScorePlayerName = this.cacheService.getCachedUser(highestScorePlayer.user).username;
		const highestAccuracyPlayerName = this.cacheService.getCachedUser(highestAccuracyPlayer.user).username;

		resultString += `**MVP score**: __${highestScorePlayerName}__ with ${highestScorePlayer.score} points and ${highestScorePlayer.accuracy}% accuracy\n`;
		resultString += `**MVP accuracy**: __${highestAccuracyPlayerName}__ with ${highestAccuracyPlayer.score} points and ${highestAccuracyPlayer.accuracy}% accuracy\n\n`;

		resultString += `Next pick is for __${multiplayerLobby.getNextPick()}__`;

		const body = {
			embeds: [
				{
					title: `🏁 ${embedHeader}`,
					url: multiplayerLobby.multiplayerLink,
					description: resultString,
					color: lostTheirPick ? 0xad324f : 0x32a852,
					thumbnail: {
						url: `https://b.ppy.sh/thumb/${foundBeatmap.beatmapsetId}.jpg`
					},
					footer: {
						text: `Match referee was ${referee}`
					},
					fields: [
					]
				}
			]
		};

		this.setCustomizedFields(body, false);

		for (const webhook of multiplayerLobby.tournament.webhooks) {
			if (webhook.matchResult == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe();
			}
		}
	}

	/**
	 * Send the multiplayer lobby details through a discord webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param referee the referee
	 */
	sendMatchCreation(selectedLobby: Lobby, referee: string, streamerList?: string[], commentatorList?: string[]): void {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby, true)) {
			return;
		}

		const body = {
			embeds: [
				{
					title: '',
					url: selectedLobby.multiplayerLink,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					fields: []
				}
			]
		};

		if (selectedLobby.isQualifierLobby == true) {
			body.embeds[0].title = `Multiplayer lobby - ${selectedLobby.description}`;

			body.embeds[0].fields.push(
				{
					name: 'Twitch multiplayer link command',
					value: `\`!editcom !mp ${selectedLobby.tournament.name}: ${selectedLobby.description}\``
				},
				{
					name: 'Twitch stream title command',
					value: `\`!title ${selectedLobby.tournament.name}: ${selectedLobby.description}\``
				});
		}
		else {
			body.embeds[0].title = `Multiplayer lobby - ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}`;

			body.embeds[0].fields.push(
				{
					name: 'Twitch multiplayer link command',
					value: `\`!editcom !mp ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}: ${selectedLobby.multiplayerLink}\``
				},
				{
					name: 'Twitch stream title command',
					value: `\`!title ${selectedLobby.tournament.name} - ${selectedLobby.selectedStage.name}: ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}\``
				});

			if (commentatorList != null && commentatorList.length > 0) {
				const casters = commentatorList.length == 1 ? commentatorList[0] : commentatorList.join(' and ');

				body.embeds[0].fields.push(
					{
						name: 'Twitch casters command',
						value: `\`!editcom !casters Casting this match is ${casters}\``
					});
			}

			if (streamerList != null && streamerList.length > 0) {
				const streamers = streamerList.length == 1 ? streamerList[0] : streamerList.join(' and ');

				if (streamerList.length == 1) {
					body.embeds[0].fields.push(
						{
							name: 'osu! streamer addref',
							value: `\`!mp addref ${streamerList[0]}\``
						});
				}
				else {
					let streamerAddref = '';

					for (const streamer of streamerList) {
						streamerAddref += `\`!editcom !streamer Streaming this match is ${streamer}\`\n`;
					}

					body.embeds[0].fields.push(
						{
							name: 'osu! streamer addref',
							value: streamerAddref
						});
				}
			}
		}

		this.setCustomizedFields(body, false);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.matchCreation == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe();
			}
		}
	}

	/**
	 * Send the picked beatmap through a discord webhook
	 *
	 * @param selectedLobby the lobby to get the data from
	 * @param referee the referee
	 * @param teamName the team that picked the map
	 * @param pick the picked map
	 */
	sendBeatmapPicked(selectedLobby: Lobby, referee: string, teamName: string, pick: WyModBracketMap): void {
		// Dont send webhooks if its disabled
		if (!this.doSendWebhooks(selectedLobby)) {
			return;
		}

		// Dont send webhook if its a qualifier lobby
		if (selectedLobby.isQualifierLobby == true) {
			return;
		}

		const body = {
			embeds: [
				{
					title: `📌 Pick update - ${selectedLobby.teamOneName} vs ${selectedLobby.teamTwoName}`,
					url: selectedLobby.multiplayerLink,
					description: `**${teamName}** has picked [**${pick.beatmapName}**](${pick.beatmapUrl})`,
					color: 15258703,
					footer: {
						text: `Match referee was ${referee}`
					},
					thumbnail: {
						url: `https://b.ppy.sh/thumb/${pick.beatmapsetId}.jpg`
					},
					fields: [
					]
				}
			]
		};

		this.setCustomizedFields(body, false);

		for (const webhook of selectedLobby.tournament.webhooks) {
			if (webhook.picks == true) {
				this.http.post(webhook.url, body, { headers: new HttpHeaders({ 'Content-type': 'application/json' }) }).subscribe();
			}
		}
	}

	/**
	 * Check if webhooks are supposed to be sent
	 *
	 * @param lobby the lobby to check
	 */
	private doSendWebhooks(lobby: Lobby, matchCreation?: boolean): boolean {
		if (lobby.sendWebhooks == null || lobby.sendWebhooks == undefined || lobby.sendWebhooks == false) {
			return false;
		}

		if (lobby.isQualifierLobby == true) {
			if (matchCreation == true) {
				return true;
			}
			else {
				return false;
			}
		}

		return true;
	}

	/**
	 * Set the various customized fields if setup by the user
	 *
	 * @param embed the embed to add the customized fields to
	 */
	private setCustomizedFields(embed: any, useBottomImage: boolean) {
		const isUndefined = ['', null, undefined];

		if (!isUndefined.includes(this.authorImage)) {
			embed.avatar_url = this.authorImage;
		}

		if (!isUndefined.includes(this.authorName)) {
			embed.username = this.authorName;
		}

		if (!isUndefined.includes(this.bottomImage) && useBottomImage == true) {
			if (!embed.embeds[0].hasOwnProperty('image')) {
				embed.embeds[0].image = {};
			}

			embed.embeds[0].image.url = this.bottomImage;
		}

		if (!isUndefined.includes(this.footerIconUrl)) {
			if (!embed.embeds[0].hasOwnProperty('footer')) {
				embed.embeds[0].footer = {};
			}

			embed.embeds[0].footer.icon_url = this.footerIconUrl;
		}

		if (!isUndefined.includes(this.footerText)) {
			if (!embed.embeds[0].hasOwnProperty('footer')) {
				embed.embeds[0].footer = {};
			}

			embed.embeds[0].footer.text = this.footerText;
		}
	}
}
