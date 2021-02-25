export class SidebarItem {
	name: string;
	logo: string;
	svgIcon: string;
	link: string;
	subMenuItem: boolean;
	onlyShowAsTournamentHost: boolean;

	constructor(init?: Partial<SidebarItem>) {
		Object.assign(this, init);
	}
}
