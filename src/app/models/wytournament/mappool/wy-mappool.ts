import { Gamemodes } from "app/models/osu-models/osu";
import { WyModBracket } from "./wy-mod-bracket";
import { WyModCategory } from "./wy-mod-category";

export enum Availability {
	ToEveryone = 0,
	ToMe = 1,
	ToSpecificPeople = 2
}

export enum MappoolType {
	Normal = 0,
	AxS = 1,
	MysteryTournament = 2
}

export class WyMappool {
	localId: number;
	publishId: number;
	name: string;
	gamemodeId: Gamemodes;
	mappoolType: MappoolType;

	modBrackets: WyModBracket[];
	modCategories: WyModCategory[];

	modBracketIndex: number;
	modCategoryIndex: number;

	constructor(init?: Partial<WyMappool>) {
		this.modBrackets = [];
		this.modCategories = [];

		this.modBracketIndex = 0;
		this.modCategoryIndex = 0;

		Object.assign(this, init);
	}

	/**
	 * Create a true copy of the object
	 * @param mod the object to copy
	 */
	public static makeTrueCopy(mappool: WyMappool): WyMappool {
		const newMappool = new WyMappool({
			localId: mappool.localId,
			publishId: mappool.publishId,
			name: mappool.name,
			gamemodeId: mappool.gamemodeId,
			mappoolType: mappool.mappoolType,
			modBracketIndex: 0,
			modCategoryIndex: 0
		});

		for (const modBracket in mappool.modBrackets) {
			const newModBracket = WyModBracket.makeTrueCopy(mappool.modBrackets[modBracket]);

			newModBracket.index = newMappool.modBracketIndex;
			newMappool.modBracketIndex++;

			newMappool.modBrackets.push(newModBracket);
		}

		for (const modCategory in mappool.modCategories) {
			const newModCategory = WyModCategory.makeTrueCopy(mappool.modCategories[modCategory])
			newModCategory.index = newMappool.modCategoryIndex;

			newMappool.modCategoryIndex++;

			newMappool.modCategories.push(newModCategory);
		}

		return newMappool;
	}
}
