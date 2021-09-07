import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IrcService } from '../../services/irc.service';
import { ElectronService } from '../../services/electron.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { VirtualScrollerComponent } from 'ngx-virtual-scroller';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { StoreService } from '../../services/store.service';
import { ToastType } from '../../models/toast';
import { WebhookService } from '../../services/webhook.service';
import { MatDialog } from '@angular/material/dialog';
import { JoinIrcChannelComponent } from '../dialogs/join-irc-channel/join-irc-channel.component';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { BanBeatmapComponent } from '../dialogs/ban-beatmap/ban-beatmap.component';
import { MultiplayerLobbyPlayersPlayer } from 'app/models/mutliplayer-lobby-players/multiplayer-lobby-players-player';
import { MultiplayerLobbyMovePlayerComponent } from '../dialogs/multiplayer-lobby-move-player/multiplayer-lobby-move-player.component';
import { MultiplayerLobbyPlayers } from 'app/models/mutliplayer-lobby-players/multiplayer-lobby-players';
import { SendBeatmapResultComponent } from '../dialogs/send-beatmap-result/send-beatmap-result.component';
import { WyMultiplayerLobbiesService } from 'app/services/wy-multiplayer-lobbies.service';
import { IrcChannel } from 'app/models/irc/irc-channel';
import { Lobby } from 'app/models/lobby';
import { IrcMessage } from 'app/models/irc/irc-message';
import { WyModBracket } from 'app/models/wytournament/mappool/wy-mod-bracket';
import { WyModBracketMap } from 'app/models/wytournament/mappool/wy-mod-bracket-map';
import { WyMappool } from 'app/models/wytournament/mappool/wy-mappool';

export interface BanBeatmapDialogData {
	beatmap: WyModBracketMap;
	modBracket: WyModBracket;
	multiplayerLobby: Lobby;

	banForTeam: string;
}

export interface MultiplayerLobbyMovePlayerDialogData {
	allPlayers: MultiplayerLobbyPlayers;
	movePlayer: MultiplayerLobbyPlayersPlayer;
	moveToSlot: number;
}

export interface SendBeatmapResultDialogData {
	multiplayerLobby: Lobby;
	ircChannel: string;
}

@Component({
	selector: 'app-irc',
	templateUrl: './irc.component.html',
	styleUrls: ['./irc.component.scss']
})
export class IrcComponent implements OnInit {
	@ViewChild('channelName') channelName: ElementRef;
	@ViewChild('chatMessage') chatMessage: ElementRef;

	@ViewChild(VirtualScrollerComponent, { static: true }) private virtualScroller: VirtualScrollerComponent;

	selectedChannel: IrcChannel;
	selectedLobby: Lobby;
	channels: IrcChannel[];

	chats: IrcMessage[] = [];
	viewPortItems: IrcMessage[];

	chatLength = 0;
	keyPressed = false;

	isAttemptingToJoin = false;
	attemptingToJoinChannel: string;

	isOptionMenuMinimized = true;
	isPlayerManagementMinimized = true;

	@ViewChild('teamMode') teamMode: MatSelect;
	@ViewChild('winCondition') winCondition: MatSelect;
	@ViewChild('players') players: MatSelect;

	searchValue: string;

	roomSettingGoingOn = false;
	roomSettingDelay = 3;

	teamOneScore = 0;
	teamTwoScore = 0;
	nextPick: string = null;
	matchpoint: string = null;
	hasWon: string = null;

	popupBannedMap: WyModBracketMap = null;
	popupBannedBracket: WyModBracket = null;

	constructor(
		public electronService: ElectronService,
		public ircService: IrcService,
		private storeService: StoreService,
		private multiplayerLobbies: WyMultiplayerLobbiesService,
		private router: Router,
		private toastService: ToastService,
		private webhookService: WebhookService,
		private dialog: MatDialog) {
		this.channels = ircService.allChannels;

		this.ircService.getIsAuthenticated().subscribe(isAuthenticated => {
			// Check if the user was authenticated
			if (isAuthenticated) {
				for (const channel in this.channels) {
					// Change the channel if it was the last active channel
					if (this.channels[channel].lastActiveChannel) {
						this.changeChannel(this.channels[channel].name, true);
						break;
					}
				}
			}
		});

		// Initialize the scroll
		this.ircService.hasMessageBeenSend().subscribe(() => {
			if (!this.viewPortItems) {
				return;
			}

			if (this.viewPortItems[this.viewPortItems.length - 1] === this.chats[this.chats.length - 2]) {
				this.scrollToTop();
			}

			if (this.selectedChannel && ircService.getChannelByName(this.selectedChannel.name).hasUnreadMessages) {
				ircService.getChannelByName(this.selectedChannel.name).hasUnreadMessages = false;
			}
		});
	}

	ngOnInit() {
		this.ircService.getIsJoiningChannel().subscribe(value => {
			this.isAttemptingToJoin = value;
		});
	}

	/**
	 * Change the channel
	 * @param channel the channel to change to
	 */
	changeChannel(channel: string, delayScroll = false) {
		if (this.selectedChannel != undefined) {
			this.selectedChannel.lastActiveChannel = false;
			this.ircService.changeLastActiveChannel(this.selectedChannel, false);
		}

		this.selectedChannel = this.ircService.getChannelByName(channel);
		this.selectedLobby = this.multiplayerLobbies.getMultiplayerLobbyByIrc(channel);

		this.selectedChannel.lastActiveChannel = true;
		this.ircService.changeLastActiveChannel(this.selectedChannel, true);

		this.selectedChannel.hasUnreadMessages = false;
		this.chats = this.selectedChannel.messages;

		this.multiplayerLobbies.synchronizeIsCompleted().subscribe(data => {
			if (data != -1) {
				this.refreshIrcHeader(this.multiplayerLobbies.getMultiplayerLobby(data));
			}
		});

		if (this.selectedLobby != undefined) {
			this.teamOneScore = this.selectedLobby.teamOneScore;
			this.teamTwoScore = this.selectedLobby.teamTwoScore;
			this.nextPick = this.selectedLobby.getNextPick();
			this.matchpoint = this.selectedLobby.getMatchPoint();
			this.hasWon = this.selectedLobby.teamHasWon();
		}

		// Scroll to the bottom - delay it by 500 ms or do it instantly
		if (delayScroll) {
			setTimeout(() => {
				this.scrollToTop();
			}, 500);
		}
		else {
			this.scrollToTop();
		}

		// Reset search bar
		this.searchValue = '';
	}

	/**
	 * Attempt to join a channel
	 */
	joinChannel() {
		const dialogRef = this.dialog.open(JoinIrcChannelComponent);

		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				this.attemptingToJoinChannel = result;
				this.ircService.joinChannel(result);
			}
		});
	}

	/**
	 * Part from a channel
	 * @param channelName the channel to part
	 */
	partChannel(channelName: string) {
		this.ircService.partChannel(channelName);

		if (this.selectedChannel != undefined && (this.selectedChannel.name == channelName)) {
			this.selectedChannel = undefined;
			this.chats = [];
		}
	}

	/**
	 * Send the entered message to the selected channel
	 */
	sendMessage(event: KeyboardEvent) {
		if (event.key == 'Enter') {
			if (this.chatMessage.nativeElement.value != '') {
				this.ircService.sendMessage(this.selectedChannel.name, this.chatMessage.nativeElement.value);
				this.chatMessage.nativeElement.value = '';
			}
		}
	}

	/**
	 * Drop a channel to rearrange it
	 * @param event
	 */
	dropChannel(event: CdkDragDrop<IrcChannel[]>) {
		moveItemInArray(this.channels, event.previousIndex, event.currentIndex);

		this.ircService.rearrangeChannels(this.channels);
	}

	/**
	 * Open the link to the users userpage
	 * @param username
	 */
	openUserpage(username: string) {
		this.electronService.openLink(`https://osu.ppy.sh/users/${username}`);
	}

	/**
	 * Change the current mappool
	 * @param event
	 */
	onMappoolChange(event: MatSelectChange) {
		this.selectedLobby.mappoolId = parseInt(event.value);
		this.selectedLobby.mappool = this.selectedLobby.tournament.getMappoolFromId(this.selectedLobby.mappoolId);

		this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);
	}

	/**
	 * Pick a beatmap from the given bracket
	 * @param beatmap the picked beatmap
	 * @param bracket the bracket where the beatmap is from
	 */
	pickBeatmap(beatmap: WyModBracketMap, bracket: WyModBracket, gamemode: number) {
		this.ircService.sendMessage(this.selectedChannel.name, `!mp map ${beatmap.beatmapId} ${gamemode}`);

		let modBit = 0;
		let freemodEnabled = false;

		for (const mod in bracket.mods) {
			if (bracket.mods[mod].value != 'freemod') {
				modBit += Number(bracket.mods[mod].value);
			}
			else {
				freemodEnabled = true;
			}
		}

		// Add an extra null check
		if (this.selectedLobby.teamOnePicks == null) {
			this.selectedLobby.teamOnePicks = [];
		}

		if (this.selectedLobby.teamTwoPicks == null) {
			this.selectedLobby.teamTwoPicks = [];
		}

		this.webhookService.sendBeatmapPicked(this.selectedLobby, this.ircService.authenticatedUser, this.selectedLobby.getNextPick(), beatmap);

		// Update picks
		if (this.selectedLobby.teamOneName == this.nextPick) {
			this.selectedLobby.teamOnePicks.push(beatmap.beatmapId);
		}
		else {
			this.selectedLobby.teamTwoPicks.push(beatmap.beatmapId);
		}

		this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);

		this.ircService.sendMessage(this.selectedChannel.name, `!mp mods ${modBit}${freemodEnabled ? ' freemod' : ''}`);
	}

	/**
	 * Unpick a beatmap
	 * @param beatmap
	 * @param bracket
	 */
	unpickBeatmap(beatmap: WyModBracketMap, bracket: WyModBracket) {
		if (this.selectedLobby.teamOnePicks.indexOf(beatmap.beatmapId) > -1) {
			this.selectedLobby.teamOnePicks.splice(this.selectedLobby.teamOnePicks.indexOf(beatmap.beatmapId), 1);
		}
		else if (this.selectedLobby.teamTwoPicks.indexOf(beatmap.beatmapId) > -1) {
			this.selectedLobby.teamTwoPicks.splice(this.selectedLobby.teamTwoPicks.indexOf(beatmap.beatmapId), 1);
		}

		this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);
	}

	/**
	 * Change what team picked the map
	 * @param beatmap
	 * @param bracket
	 */
	changePickedBy(beatmap: WyModBracketMap, bracket: WyModBracket) {
		if (this.selectedLobby.teamOnePicks.indexOf(beatmap.beatmapId) > -1) {
			this.selectedLobby.teamOnePicks.splice(this.selectedLobby.teamOnePicks.indexOf(beatmap.beatmapId), 1);
			this.selectedLobby.teamTwoPicks.push(beatmap.beatmapId);
		}
		else if (this.selectedLobby.teamTwoPicks.indexOf(beatmap.beatmapId) > -1) {
			this.selectedLobby.teamTwoPicks.splice(this.selectedLobby.teamTwoPicks.indexOf(beatmap.beatmapId), 1);
			this.selectedLobby.teamOnePicks.push(beatmap.beatmapId);
		}

		this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);
	}

	/**
	 * Change the room settings
	 */
	onRoomSettingChange() {
		if (!this.roomSettingGoingOn) {
			const timer =
				setInterval(() => {
					if (this.roomSettingDelay == 0) {
						this.ircService.sendMessage(this.selectedChannel.name, `!mp set ${this.teamMode.value} ${this.winCondition.value} ${this.players.value}`);

						this.ircService.getChannelByName(this.selectedChannel.name).teamMode = this.teamMode.value;
						this.ircService.getChannelByName(this.selectedChannel.name).winCondition = this.winCondition.value;
						this.ircService.getChannelByName(this.selectedChannel.name).players = this.players.value;

						this.roomSettingGoingOn = false;
						clearInterval(timer);
					}

					this.roomSettingDelay--;
				}, 1000);

			this.roomSettingGoingOn = true;
		}

		this.roomSettingDelay = 3;
	}

	/**
	 * Navigate to the lobbyoverview from irc
	 */
	navigateLobbyOverview() {
		const lobbyId = this.multiplayerLobbies.getMultiplayerLobbyByIrc(this.selectedChannel.name).lobbyId;

		if (lobbyId) {
			this.router.navigate(['/lobby-overview/lobby-view', lobbyId]);
		}
		else {
			this.toastService.addToast('No lobby overview found for this irc channel');
		}
	}

	/**
	 * Refresh the stats for a multiplayer lobby.
	 * @param multiplayerLobby the multiplayerlobby
	 */
	refreshIrcHeader(multiplayerLobby: Lobby) {
		this.teamOneScore = multiplayerLobby.teamOneScore;
		this.teamTwoScore = multiplayerLobby.teamTwoScore;
		this.nextPick = multiplayerLobby.getNextPick();
		this.matchpoint = multiplayerLobby.getMatchPoint();
		this.hasWon = multiplayerLobby.teamHasWon();
	}

	/**
	 * Play a sound when a message is being send to a specific channel
	 * @param channel the channel that should where a message should be send from
	 * @param status mute or unmute the sound
	 */
	playSound(channel: IrcChannel, status: boolean) {
		channel.playSoundOnMessage = status;
		this.storeService.set(`irc.channels.${channel.name}.playSoundOnMessage`, status);
		this.toastService.addToast(`${channel.name} will ${status == false ? 'no longer beep on message' : 'now beep on message'}.`);
	}

	/**
	 * Ban a beatmap
	 */
	banBeatmap(beatmap: WyModBracketMap, modBracket: WyModBracket, multiplayerLobby: Lobby) {
		const dialogRef = this.dialog.open(BanBeatmapComponent, {
			data: {
				beatmap: beatmap,
				modBracket: modBracket,
				multiplayerLobby: multiplayerLobby
			}
		});

		dialogRef.afterClosed().subscribe((result: BanBeatmapDialogData) => {
			if (result != null) {
				if (result.banForTeam == result.multiplayerLobby.teamOneName) {
					this.selectedLobby.teamOneBans.push(result.beatmap.beatmapId);
					this.webhookService.sendBanResult(result.multiplayerLobby, result.multiplayerLobby.teamOneName, result.beatmap, this.ircService.authenticatedUser);
				}
				else {
					this.selectedLobby.teamTwoBans.push(result.beatmap.beatmapId);
					this.webhookService.sendBanResult(result.multiplayerLobby, result.multiplayerLobby.teamTwoName, result.beatmap, this.ircService.authenticatedUser);
				}

				this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);
			}
		});
	}

	/**
	 * Check if a beatmap is banned int he current lobby
	 * @param multiplayerLobby the multiplayerlobby to check from
	 * @param beatmapId the beatmap to check
	 */
	beatmapIsBanned(multiplayerLobby: Lobby, beatmapId: number) {
		return multiplayerLobby.teamOneBans.indexOf(beatmapId) > -1 || multiplayerLobby.teamTwoBans.indexOf(beatmapId) > -1;
	}

	/**
	 * Check if the beatmap is banned by team one
	 * @param multiplayerLobby the multiplayerlobby to check from
	 * @param beatmapId the beatmap to check
	 */
	beatmapIsBannedByTeamOne(multiplayerLobby: Lobby, beatmapId: number) {
		return multiplayerLobby.teamOneBans.indexOf(beatmapId) > -1;
	}

	/**
	 * Check if the beatmap is banned by team two
	 * @param multiplayerLobby the multiplayerlobby to check from
	 * @param beatmapId the beatmap to check
	 */
	beatmapIsBannedByTeamTwo(multiplayerLobby: Lobby, beatmapId: number) {
		return multiplayerLobby.teamTwoBans.indexOf(beatmapId) > -1;
	}

	/**
	 * Check if a beatmap has been picked in the current lobby
	 * @param multiplayerLobby the multiplayerlobby to check from
	 * @param beatmapId the beatmap to check
	 */
	beatmapIsPicked(multiplayerLobby: Lobby, beatmapId: number) {
		return multiplayerLobby.teamOnePicks != null && multiplayerLobby.teamTwoPicks != null &&
			(multiplayerLobby.teamOnePicks.indexOf(beatmapId) > -1 || multiplayerLobby.teamTwoPicks.indexOf(beatmapId) > -1);
	}

	/**
	 * Check if a beatmap has been picked by team one in the current lobby
	 * @param multiplayerLobby the multiplayerlobby to check from
	 * @param beatmapId the beatmap to check
	 */
	beatmapIsPickedByTeamOne(multiplayerLobby: Lobby, beatmapId: number) {
		return multiplayerLobby.teamOnePicks != null && multiplayerLobby.teamOnePicks.indexOf(beatmapId) > -1;
	}

	/**
	 * Check if a beatmap has been picked by team two in the current lobby
	 * @param multiplayerLobby the multiplayerlobby to check from
	 * @param beatmapId the beatmap to check
	 */
	beatmapIsPickedByTeamTwo(multiplayerLobby: Lobby, beatmapId: number) {
		return multiplayerLobby.teamTwoPicks != null && multiplayerLobby.teamTwoPicks.indexOf(beatmapId) > -1;
	}

	/**
	 * Unban a beatmap
	 * @param beatmap
	 * @param bracket
	 */
	unbanBeatmap(beatmap: WyModBracketMap) {
		if (this.selectedLobby.teamOneBans.indexOf(beatmap.beatmapId) > -1) {
			this.selectedLobby.teamOneBans.splice(this.selectedLobby.teamOneBans.indexOf(beatmap.beatmapId), 1);
		}
		else if (this.selectedLobby.teamTwoBans.indexOf(beatmap.beatmapId) > -1) {
			this.selectedLobby.teamTwoBans.splice(this.selectedLobby.teamTwoBans.indexOf(beatmap.beatmapId), 1);
		}

		this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);
	}

	/**
	 * Pick a mystery map
	 * @param mappool the mappool to pick from
	 * @param modBracket the modbracket to pick from
	 */
	pickMysteryMap(mappool: WyMappool, modBracket: WyModBracket) {
		this.multiplayerLobbies.pickMysteryMap(mappool, modBracket, this.selectedLobby, this.ircService.authenticatedUser).subscribe((res: any) => {
			if (res.modCategory == null) {
				this.toastService.addToast(res.beatmapName, ToastType.Error, 60);
			}
			else {
				const modBracketMap = WyModBracketMap.makeTrueCopy(res);
				this.pickBeatmap(modBracketMap, modBracket, mappool.gamemodeId);

				// Pick a random map and update it to the cache
				this.selectedLobby.pickModCategoryFromBracket(modBracket, modBracketMap.modCategory);
				this.multiplayerLobbies.updateMultiplayerLobby(this.selectedLobby);
			}
		});
	}

	/**
	 * Toggle the player management tab
	 */
	togglePlayerManagement() {
		this.isPlayerManagementMinimized = !this.isPlayerManagementMinimized

		if (!this.isPlayerManagementMinimized) {
			this.scrollToTop();
		}
	}

	/**
	 * Change the host to a different player
	 * @param player
	 */
	setHost(player: MultiplayerLobbyPlayersPlayer) {
		this.ircService.sendMessage(this.selectedChannel.name, `!mp host ${player.username}`);
	}

	/**
	 * Kick the player from the match
	 * @param player
	 */
	kickPlayer(player: MultiplayerLobbyPlayersPlayer) {
		this.ircService.sendMessage(this.selectedChannel.name, `!mp kick ${player.username}`);
	}

	/**
	 * Move the player to a different slot
	 * @param player
	 */
	movePlayer(player: MultiplayerLobbyPlayersPlayer) {
		const dialogRef = this.dialog.open(MultiplayerLobbyMovePlayerComponent, {
			data: {
				movePlayer: player,
				allPlayers: this.selectedLobby.multiplayerLobbyPlayers
			}
		});

		dialogRef.afterClosed().subscribe((result: MultiplayerLobbyMovePlayerDialogData) => {
			if (result != undefined) {
				this.ircService.sendMessage(this.selectedChannel.name, `!mp move ${result.movePlayer.username} ${result.moveToSlot}`);
			}
		});
	}

	/**
	 * Change the colour of the current player
	 * @param player
	 */
	changeTeam(player: MultiplayerLobbyPlayersPlayer) {
		const newTeamColour = player.team == 'Red' ? 'blue' : 'red';
		this.ircService.sendMessage(this.selectedChannel.name, `!mp team ${player.username} ${newTeamColour}`);
	}

	/**
	 * Scroll irc chat to top
	 */
	scrollToTop() {
		this.virtualScroller.scrollToIndex(this.chats.length - 1, true, 0, 0);
	}

	/**
	 * Open a dialog to easily send result to the multiplayer lobby
	 */
	sendMatchResult() {
		const selectedMultiplayerLobby = this.multiplayerLobbies.getMultiplayerLobbyByIrc(this.selectedChannel.name);

		this.dialog.open(SendBeatmapResultComponent, {
			data: {
				multiplayerLobby: selectedMultiplayerLobby,
				ircChannel: this.selectedChannel.name
			}
		});
	}
}
