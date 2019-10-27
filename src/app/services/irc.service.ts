import { Injectable } from '@angular/core';
import * as irc from 'irc-upd';
import { ToastService } from './toast.service';
import { ToastType } from '../models/toast';
import { StoreService } from './store.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { Channel } from '../models/irc/channel';
import { Message } from '../models/irc/message';
import { Regex } from '../models/irc/regex';
import { MessageBuilder, MessageType } from '../models/irc/message-builder';

@Injectable({
  	providedIn: 'root'
})

export class IrcService {
	irc: typeof irc;
	client: typeof irc.Client;

	/**
	 * Whether or not the user is authenticated to irc
	 */
	isAuthenticated: boolean = false;

	/**
	 * The username of the authenticated user
	 */
	authenticatedUser: string = "none";

	allChannels: Channel[] = [];

	// Variables to tell if we are connecting/disconnecting to irc
	isConnecting$: BehaviorSubject<boolean>;
	isDisconnecting$: BehaviorSubject<boolean>;
	isJoiningChannel$: BehaviorSubject<boolean>;
	messageHasBeenSend$: BehaviorSubject<boolean>;

  	constructor(private toastService: ToastService, private storeService: StoreService) { 
		this.irc = require('irc-upd');

		// Create observables for is(Dis)Connecting
		this.isConnecting$ = new BehaviorSubject<boolean>(false);
		this.isDisconnecting$ = new BehaviorSubject<boolean>(false);
		this.isJoiningChannel$ = new BehaviorSubject<boolean>(false);
		this.messageHasBeenSend$ = new BehaviorSubject<boolean>(false);

		// Connect to irc if the credentials are saved
		const ircCredentials = storeService.get('irc');

		if(ircCredentials != undefined) {
			toastService.addToast('Irc credentials were found, attempting to login to irc.');
			this.connect(ircCredentials.username, ircCredentials.password);
		}

		const connectedChannels = storeService.get('irc.channels');

		if(connectedChannels != undefined && Object.keys(connectedChannels).length > 0) {
			// Loop through all the channels
			for(let channel in connectedChannels) {
				const nChannel = new Channel(connectedChannels[channel].name);
				nChannel.active = connectedChannels[channel].active;
				nChannel.lastActiveChannel = connectedChannels[channel].lastActiveChannel;
				nChannel.isPrivateChannel = connectedChannels[channel].isPrivateChannel;

				// Loop through all the messages
				for(let message in connectedChannels[channel].messageHistory) {
					const thisMessage = connectedChannels[channel].messageHistory[message];
					const messageBuilder: MessageBuilder[] = [];

					// Loop through the message builder
					for(let messageInBuilder in thisMessage.message) {
						const thisMessageInBuilder = thisMessage.message[messageInBuilder];
						messageBuilder.push(new MessageBuilder(thisMessageInBuilder.messageType, thisMessageInBuilder.message, thisMessageInBuilder.linkName));
					}

					nChannel.allMessages.push(new Message(thisMessage.date, thisMessage.time, thisMessage.author, messageBuilder, true));
				}

				// Add a divider to the channel to show new messages
				nChannel.allMessages.push(new Message('n/a', 'n/a', 'Today', [new MessageBuilder(MessageType.Message, 'Messages from history')], false, true));

				this.allChannels.push(nChannel);
			}
		}
	}

	/**
	 * Check if we are connecting
	 */
	getIsConnecting(): Observable<boolean> {
		return this.isConnecting$.asObservable();
	}

	/**
	 * Check if we are disconnecting
	 */
	getIsDisconnecting(): Observable<boolean> {
		return this.isDisconnecting$.asObservable();
	}

	/**
	 * Check if we are joining a channel
	 */
	getIsJoiningChannel(): Observable<boolean> {
		return this.isJoiningChannel$.asObservable();
	}

	/**
	 * Check if there was a message send
	 */
	hasMessageBeenSend(): Observable<boolean> {
		return this.messageHasBeenSend$.asObservable();
	}

	/**
	 * Connect the user to irc
	 * @param username the username to connect with
	 * @param password the password to connect with
	 */
	connect(username: string, password: string) {
		let ircSettings = {
			password: password, 
			autoConnect: false, 
			autoRejoin: false,
			retryCount: 0,
			debug: false
		};

		const allJoinedChannels = this.storeService.get('irc.channels');

		// Check if the user already has joined channels
		if(allJoinedChannels !== undefined) {
			ircSettings['channels'] = [];

			for(let channel in allJoinedChannels) {
				ircSettings['channels'].push(allJoinedChannels[channel].name);	
			}
		}

		this.client = new irc.Client('irc.ppy.sh', username, ircSettings);

		this.isConnecting$.next(true);

		/**
		 * Error handler
		 */
		this.client.addListener('error', error => {
			// Get rid of error, hasn't been fixed by irc-upd devs yet
			if(error.message == "Cannot read property 'trim' of undefined")
				return;

			// Invalid password given
			if(error.command == "err_passwdmismatch") {
				this.isConnecting$.next(false);
				this.toastService.addToast('Invalid password given. Please try again', ToastType.Error);
			}
			// Invalid channel given
			else if(error.command === "err_nosuchchannel") {
				const channelName = error.args[1];

				if(!channelName.startsWith('#')) { }
				else if(!channelName.startsWith('#mp_')) {
					this.toastService.addToast('The channel you are trying to join does not exist.', ToastType.Error);
					this.isJoiningChannel$.next(false);
				}
				else {
					if(this.getChannelByName(channelName) != null) {
						this.getChannelByName(channelName).active = false;
						this.changeActiveChannel(this.getChannelByName(channelName), false);
					}
				}
			}
			// Unhandled error
			else {
				console.log(error);

				this.toastService.addToast('Unknown error given! Check the console for more information.', ToastType.Error);
			}
		});

		/**
		 * Message handler
		 */
		this.client.addListener('message', (from: string, to: string, message: string) => {
			this.addMessageToChannel(to, from, message, !to.startsWith('#'));
		});

		/**
		 * "/me" handler
		 */
		this.client.addListener('action', (from, to, message) => {
			this.addMessageToChannel(to, from, message);
		});

		/**
		 * Connect the user
		 */
		this.client.connect(0, err => {
			this.isAuthenticated = true;
			this.authenticatedUser = username;

			// Save the credentials
			this.storeService.set('irc.username', username);
			this.storeService.set('irc.password', password);

			this.isConnecting$.next(false);

			this.toastService.addToast('Successfully connected to irc!');
		});
	}

	/**
	 * Disconnect the user from irc
	 */
	disconnect() {
		if(this.isAuthenticated) {
			this.client.removeAllListeners();

			this.isDisconnecting$.next(true);

			this.client.disconnect('', () => {
				this.isAuthenticated = false;
				this.authenticatedUser = "none";

				// Delete the credentials
				this.storeService.delete('irc');

				this.isDisconnecting$.next(false);

				this.toastService.addToast('Successfully disconnected from irc.');
			});
		}
	}

	/**
	 * Get the channel by its name
	 * @param channelName the channelname
	 */
	getChannelByName(channelName: string) {
		let channel: Channel = null;
		for(let i in this.allChannels) {
			if(this.allChannels[i].channelName == channelName) {
				channel = this.allChannels[i];
				break;
			}
		}

		return channel;
	}

	/**
	 * Add a message to the given channel. Will not send the message to irc
	 * @param channelName the channel to add the message to 
	 * @param author the author of the message
	 * @param message the message itself
	 * @param isPM if the message came from a PM
	 */
	addMessageToChannel(channelName: string, author: string, message: string, isPM: boolean = false) {
		const 	date = new Date(),
				timeFormat = `${(date.getHours() <= 9 ? '0' : '')}${date.getHours()}:${(date.getMinutes() <= 9 ? '0' : '')}${date.getMinutes()}`,
				dateFormat = `${(date.getDate() <= 9 ? '0' : '')}${date.getDate()}/${(date.getMonth() <= 9 ? '0' : '')}${date.getMonth()}/${date.getFullYear()}`;

		const newMessage = new Message(dateFormat, timeFormat, author, this.buildMessage(message));

		if(isPM) {
			if(this.getChannelByName(author) == null) {
				this.joinChannel(author);
			}
			
			this.getChannelByName(author).allMessages.push(newMessage);
			this.saveMessageToHistory(author, newMessage);
		}
		else {
			this.getChannelByName(channelName).allMessages.push(newMessage);
			this.saveMessageToHistory(channelName, newMessage);
		}

		this.messageHasBeenSend$.next(true);
	}

	/**
	 * Join a channel
	 * @param channelName the channel to join
	 */
	joinChannel(channelName: string) {
		const allJoinedChannels = this.storeService.get('irc.channels');
		this.isJoiningChannel$.next(true);

		// Check if you have already joined the channel
		if(allJoinedChannels != undefined && allJoinedChannels.hasOwnProperty(channelName)) {
			this.toastService.addToast(`You have already joined the channel "${channelName}".`);
			return;
		}

		if(!channelName.startsWith('#')) {
			const getChannel = this.getChannelByName(channelName);

			if(getChannel == null) {
				this.allChannels.push(new Channel(channelName, true));

				this.storeService.set(`irc.channels.${channelName}`, {
					name: channelName,
					active: true,
					messageHistory: [],
					lastActiveChannel: false,
					isPrivateChannel: true
				});

				this.toastService.addToast(`Opened private message channel with "${channelName}".`);
			}

			this.isJoiningChannel$.next(false);
		}
		else {
			this.client.join(channelName, () => {
				this.storeService.set(`irc.channels.${channelName}`, {
					name: channelName,
					active: true,
					messageHistory: [],
					lastActiveChannel: false,
					isPrivateChannel: false
				});
	
				this.isJoiningChannel$.next(false);
	
				this.allChannels.push(new Channel(channelName));
	
				this.toastService.addToast(`Joined channel "${channelName}".`);
			});
		}
	}

	/**
	 * Part from the given channel
	 * @param channelName the channel to part
	 */
	partChannel(channelName: string) {
		const allJoinedChannels = this.storeService.get('irc.channels');

		if(allJoinedChannels.hasOwnProperty(channelName)) {

			for(let i in this.allChannels) {
				if(this.allChannels[i].channelName == channelName) {
					this.allChannels.splice(parseInt(i), 1);
					break;
				}
			}

			this.client.part(channelName);

			delete allJoinedChannels[channelName];

			this.storeService.set('irc.channels', allJoinedChannels);
			this.toastService.addToast(`Successfully parted "${channelName}".`);
		}
	}

	/**
	 * Send a message to the said channel
	 * @param channelName the channel to send the message in
	 * @param message the message to send
	 */
	sendMessage(channelName: string, message: string) {
		this.addMessageToChannel(channelName, this.authenticatedUser, message);
		this.client.say(channelName, message);
	}

	/**
	 * Save the rearranged channels
	 * @param channels the rearranged channels
	 */
	rearrangeChannels(channels: Channel[]) {
		let rearrangedChannels = {};

		for(let i in channels) {
			rearrangedChannels[channels[i].channelName] = {
				name: channels[i].channelName,
				active: channels[i].active,
				messageHistory: channels[i].allMessages,
				lastActiveChannel: channels[i].lastActiveChannel,
				isPrivateChannel: channels[i].isPrivateChannel
			};
		}

		this.storeService.set('irc.channels', rearrangedChannels);
	}
	
	/**
	 * Change the last active status in the store for the given channel
	 * @param channel the channel to change the status of
	 * @param active the status
	 */
	changeLastActiveChannel(channel: Channel, active: boolean) {
		const storeChannel = this.storeService.get(`irc.channels.${channel.channelName}`);

		storeChannel.lastActiveChannel = active;

		this.storeService.set(`irc.channels.${channel.channelName}`, storeChannel);
	}

	/**
	 * Change the active status in the store for the given channel
	 * @param channel the channel to change the status of
	 * @param active the status
	 */
	changeActiveChannel(channel: Channel, active: boolean) {
		const storeChannel = this.storeService.get(`irc.channels.${channel.channelName}`);

		storeChannel.active = active;

		this.storeService.set(`irc.channels.${channel.channelName}`, storeChannel);
	}

	/**
	 * Save the message in the channel history
	 * @param channelName the channel to save it in
	 * @param message the message object to save
	 */
	saveMessageToHistory(channelName: string, message: Message) {
		const storeChannel = this.storeService.get(`irc.channels.${channelName}`);
		storeChannel.messageHistory.push(message.convertToJson());
		this.storeService.set(`irc.channels.${channelName}`, storeChannel);
	}

	/**
	 * Build a message with the appropriate hyperlinks
	 * @param message the message to build
	 */
	buildMessage(message: string): MessageBuilder[] {
		let messageBuilder: MessageBuilder[] = [];

		const allRegexes = [
			Regex.isListeningTo,
			Regex.isWatching,
			Regex.isPlaying,
			Regex.isEditing,
			Regex.playerBeatmapChange
		];

		let regexSucceeded = false;

		// Handle all the regexes
		for(let regex in allRegexes) {
			const currentRegex = allRegexes[regex].run(message);

			if(currentRegex != null) {
				messageBuilder.push(new MessageBuilder(MessageType.Message, currentRegex.message));
				messageBuilder.push(new MessageBuilder(MessageType.Link, currentRegex.link, currentRegex.name));

				regexSucceeded = true;
			}
		}

		// Handle messages that do not match any of the regexes
		if(!regexSucceeded) {
			const isLinkRegex = Regex.isLink.run(message);

			// Check if there is a link
			if(isLinkRegex != null) {
				const splittedString = message.split(Regex.isLink.regex).filter(s => s != "" && s.trim());

				for(let split in splittedString) {
					// The split is a link
					if(Regex.isLink.run(splittedString[split])) {
						messageBuilder.push(new MessageBuilder(MessageType.Link, splittedString[split]));
					}
					// The split is a message
					else {
						messageBuilder.push(new MessageBuilder(MessageType.Message, splittedString[split]));
					}
				}
			}
			else {
				messageBuilder.push(new MessageBuilder(MessageType.Message, message));
			}
		}

		return messageBuilder;
	}
}
