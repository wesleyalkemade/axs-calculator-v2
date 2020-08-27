import { Component, OnInit } from '@angular/core';
import { FormGroup, Validators, FormControl } from '@angular/forms';
import { AuthenticateService } from '../../../services/authenticate.service';
import { ToastService } from '../../../services/toast.service';
import { IrcService } from '../../../services/irc.service';
import { ElectronService } from '../../../services/electron.service';
import { RegisterRequest } from '../../../models/authentication/register-request';
import { LoggedInUser } from '../../../models/authentication/logged-in-user';
import { ToastType } from '../../../models/toast';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
	mappoolPublishForm: FormGroup;
	ircLoginForm: FormGroup;

	isConnecting = false;
	isDisconnecting = false;

	constructor(public auth: AuthenticateService, private toastService: ToastService, public ircService: IrcService, public electronService: ElectronService) { }

	ngOnInit() {
		this.mappoolPublishForm = new FormGroup({
			'username': new FormControl('', [
				Validators.required
			]),
			'password': new FormControl('', [
				Validators.required
			])
		});

		this.ircLoginForm = new FormGroup({
			'irc-username': new FormControl('', [
				Validators.required
			]),
			'irc-password': new FormControl('', [
				Validators.required
			])
		});

		// Subscribe to the isConnecting variable to show/hide the spinner
		this.ircService.getIsConnecting().subscribe(value => {
			this.isConnecting = value;
		});

		// Subscribe to the isConnecting variable to show/hide the spinner
		this.ircService.getIsDisconnecting().subscribe(value => {
			this.isDisconnecting = value;
		});
	}

	/**
	 * Login the user with the given username and password
	 */
	loginMappoolPublish() {
		const username = this.mappoolPublishForm.get('username').value;
		const password = this.mappoolPublishForm.get('password').value;

		const registerUser = new RegisterRequest();

		registerUser.username = username;
		registerUser.password = password;

		this.auth.login(registerUser).subscribe(data => {
			const loggedInUser: LoggedInUser = new LoggedInUser();

			loggedInUser.userId = data.body.userId;
			loggedInUser.username = data.body.username;
			loggedInUser.isAdmin = data.body.admin;
			loggedInUser.token = data.headers.get('Authorization');
			loggedInUser.isTournamentHost = data.body.tournament_host;

			this.auth.loggedInUser = loggedInUser;
			this.auth.loggedIn = true;

			this.auth.cacheLoggedInUser(loggedInUser);

			this.toastService.addToast(`Successfully logged in with the username "${this.auth.loggedInUser.username}"!`);
		}, (err) => {
			this.toastService.addToast(`${err.error.message}`, ToastType.Error);
		});
	}

	logoutMappoolPublish() {
		this.auth.logout();
		this.toastService.addToast('Successfully logged out.');
	}

	/**
	 * Login to irc with the given credentials
	 */
	connectIrc() {
		const username = this.ircLoginForm.get('username').value;
		const password = this.ircLoginForm.get('password').value;

		this.ircService.connect(username, password);
	}

	disconnectIrc() {
		this.ircService.disconnect();
	}
}
