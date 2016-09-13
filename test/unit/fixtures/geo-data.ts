import { Orm, define, field } from "../../../src";
import { knex } from "./knex";

export interface Continent {
	id: number;
	name: string;

	countries: Country[];
}
export interface Country {
	id: number;
	name: string;

	continentId: number;
	continent: Continent;

	states: State[];
	languages: Language[];
}
export interface State {
	id: number;
	name: string;

	countryId: number;
	country: Country;

	cities: City[];
}
export interface City {
	id: number;
	name: string;

	stateId: number;
	state: State;
}
export interface Language {
	id: number;
	name: string;

	countries: Country[];
}
export interface CountriesLanguagesJoin {
	countryId: number;
	languageId: number;
}

export interface ContinentOrm extends Orm {
	id: field.Numerical;
	name: field.String;

	countries: field.JoinMany<CountryOrm>;
}
export interface CountryOrm extends Orm {
	id: field.Numerical;
	code: field.String;
	name: field.String;

	continentId: field.Numerical;
	continent: field.JoinOne<ContinentOrm>;

	states: field.JoinMany<StateOrm>;
	languages: field.JoinMany<LanguageOrm>;
}
export interface StateOrm extends Orm {
	id: field.Numerical;
	code: field.String;
	name: field.String;

	countryId: field.Numerical;
	country: field.JoinOne<CountryOrm>;

	cities: field.JoinMany<CityOrm>;
}
export interface CityOrm extends Orm {
	id: field.Numerical;
	code: field.String;
	name: field.String;

	stateId: field.Numerical;
	state: field.JoinOne<StateOrm>;
}

export interface LanguageOrm extends Orm {
	id: field.Numerical;
	name: field.String;

	countries: field.JoinMany<CountryOrm>;
}
export interface CountriesLanguagesJoinOrm extends Orm {
	countryId: field.Numerical;
	languageId: field.Numerical;
}

export type Definitions = {
	continentOrm: ContinentOrm,
	countryOrm: CountryOrm,
	stateOrm: StateOrm,
	cityOrm: CityOrm,
	languageOrm: LanguageOrm,
	countriesLanguagesJoinOrm: CountriesLanguagesJoinOrm
};
export const definitions: Promise<Definitions> = Promise.all([
	define<ContinentOrm, Continent>("continents", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			countries: join.many("countries", false, true).on((country: CountryOrm, continent: ContinentOrm) => {
				return country.continentId.eq(continent.id);
			})
		};
	}),
	define<CountryOrm, Country>("countries", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			continentId: field.Numerical("continent_id", undefined, "continent.id"),
			continent: join.one("continents", true).on((country: CountryOrm, continent: ContinentOrm) => {
				return country.continentId.eq(continent.id);
			}),

			states: join.many("states", false, true).on((state: StateOrm, country: CountryOrm) => {
				return state.countryId.eq(country.id);
			}),
			languages: join.many("languages", false, true).through("countries_languages", (language: LanguageOrm, countriesLanguagesJoin: CountriesLanguagesJoinOrm) => {
				return countriesLanguagesJoin.languageId.eq(language.id);
			}).on((language: LanguageOrm, countriesLanguagesJoin: CountriesLanguagesJoinOrm, country: CountryOrm) => {
				return countriesLanguagesJoin.countryId.eq(country.id);
			})
		};
	}),
	define<StateOrm, State>("states", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			countryId: field.Numerical("country_id", undefined, "country.id"),
			country: join.one("countries", true).on((state: StateOrm, country: CountryOrm) => {
				return state.countryId.eq(country.id);
			}),

			cities: join.many("cities").on((city: CityOrm, state: StateOrm) => {
				return city.stateId.eq(state.id);
			})
		};
	}),
	define<CityOrm, City>("cities", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			stateId: field.Numerical("state_id", undefined, "state.id"),
			state: join.one("states", true).on((city: CityOrm, state: StateOrm) => {
				return city.stateId.eq(state.id);
			})
		};
	}),
	define<LanguageOrm, Language>("languages", (field, join) => {
		return {
			id: field.Numerical("id"),
			name: field.String("name"),

			countries: join.many("countries").through("countries_languages", (country: CountryOrm, countriesLanguagesJoin: CountriesLanguagesJoinOrm) => {
				return countriesLanguagesJoin.countryId.eq(country.id);
			}).on((country: CountryOrm, countriesLanguagesJoin: CountriesLanguagesJoinOrm, language: LanguageOrm) => {
				return countriesLanguagesJoin.languageId.eq(language.id);
			})
		};
	}),
	define<CountriesLanguagesJoinOrm, CountriesLanguagesJoin>("countries_languages", (field, join) => {
		return {
			countryId: field.Numerical("country_id"),
			languageId: field.String("language_id")
		};
	})
]).then(([continentOrm, countryOrm, stateOrm, cityOrm, countriesLangaugesJoinOrm]) => {
	return {
		continentOrm: continentOrm,
		countryOrm: countryOrm,
		stateOrm: stateOrm,
		cityOrm: cityOrm,
		countriesLangaugesJoinOrm: countriesLangaugesJoinOrm
	};
});

export function createTables(): Promise<void> {
	return Promise.all([
		knex.raw(`
			CREATE TEMPORARY TABLE continents (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE countries (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				continent_id INTEGER,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE states (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				country_id INTEGER,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE cities (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				state_id INTEGER,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE languages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE countries_languages (
				country_id INTEGER,
				language_id INTEGER,
				CONSTRAINT country_language_unique UNIQUE (country_id, language_id)
			);
		`)
	]);
}

export function deleteTables(): Promise<void> {
	return Promise.all([
		knex.raw(`
			DROP TABLE IF EXISTS continents;
		`),
		knex.raw(`
			DROP TABLE IF EXISTS countries;
		`),
		knex.raw(`
			DROP TABLE IF EXISTS states;
		`),
		knex.raw(`
			DROP TABLE IF EXISTS cities;
		`),
		knex.raw(`
			DROP TABLE IF EXISTS languages;
		`),
		knex.raw(`
			DROP TABLE IF EXISTS countries_languages;
		`)
	]);
}

export type Data = {
	continents: Continent[],
	countries: Country[],
	states: State[],
	cities: City[],
	languages: Language[],
	countriesLanguagesJoins: CountriesLanguagesJoin[]
};
export function mockData(): Promise<Data> {
	let continentsPromise: Promise<Continent[]> = Array(3).fill(undefined).reduce((p) => {
		return p.then(() => {
			return knex("continents").insert({
				name: randomString()
			});
		});
	}, Promise.resolve()).then(() => {
		return knex("continents").select(["id", "name"]).then((rows) => {
			return rows.map((row) => {
				return {
					id: row.id,
					name: row.name,

					countries: []
				} as Continent;
			});
		});
	});

	let languagesPromise: Promise<Language[]> = Array(5).fill(undefined).reduce((p) => {
		return p.then(() => {
			return knex("languages").insert({
				name: randomString()
			});
		});
	}, Promise.resolve()).then(() => {
		return knex("languages").select(["id", "name"]).then((rows) => {
			return rows.map((row) => {
				return {
					id: row.id,
					name: row.name,

					countries: []
				} as Language;
			});
		});
	});

	let countriesPromise: Promise<Country[]> = continentsPromise.then((continents) => {
		return Array(10).fill(undefined).reduce((p) => {
			return p.then(() => {
				return knex("countries").insert({
					continent_id: randomArrayValue(continents).id,
					name: randomString()
				});
			});
		}, Promise.resolve()).then(() => {
			return knex("countries").select(["id", "name", "continent_id"]).then((rows) => {
				return rows.map((row) => {
					let continent: Continent = continents.find((c) => c.id === row.continent_id)!;
					let country: Country = {
						id: row.id,
						name: row.name,
						continentId: row.continent_id,
						continent: continent,

						states: [],
						languages: []
					};
					continent.countries.push(country);
					return country;
				});
			});
		});
	});

	let statesPromise: Promise<State[]> = countriesPromise.then((countries) => {
		return Array(30).fill(undefined).reduce((p) => {
			return p.then(() => {
				return knex("states").insert({
					country_id: randomArrayValue(countries).id,
					name: randomString()
				});
			});
		}, Promise.resolve()).then(() => {
			return knex("states").select(["id", "name", "country_id"]).then((rows) => {
				return rows.map((row) => {
					let country: Country = countries.find((c) => c.id === row.country_id)!;
					let state: State = {
						id: row.id,
						name: row.name,
						countryId: row.country_id,
						country: country,

						cities: []
					};
					country.states.push(state);
					return state;
				});
			});
		});
	});

	let citiesPromise: Promise<City[]> = statesPromise.then((states) => {
		return Array(100).fill(undefined).reduce((p) => {
			return p.then(() => {
				return knex("cities").insert({
					state_id: randomArrayValue(states).id,
					name: randomString()
				});
			});
		}, Promise.resolve()).then(() => {
			return knex("cities").select(["id", "name", "state_id"]).then((rows) => {
				return rows.map((row) => {
					let state: State = states.find((s) => s.id === row.state_id)!;
					let city: City = {
						id: row.id,
						name: row.name,
						stateId: row.state_id,
						state: state
					};
					state.cities.push(city);
					return city;
				});
			});
		});
	});

	let countriesLanguagesJoinsPromise: Promise<CountriesLanguagesJoin[]> = Promise.all([
		countriesPromise,
		languagesPromise
	]).then(([countries, languages]) => {
		return Array(30).fill(undefined).reduce((memo) => {
			let countryId: number,
				languageId: number;
			do {
				countryId = randomArrayValue(countries).id;
				languageId = randomArrayValue(languages).id;
			} while (memo.set[`${ countryId }_${ languageId }`]);
			memo.pairs.push([countryId, languageId]);
			memo.set[`${ countryId }_${ languageId }`] = true;
			return memo;
		}, {
			pairs: [],
			set: {}
		} as {
			pairs: [number, number][],
			set: { [key: string]: boolean }
		}).pairs.reduce((p, [countryId, languageId]: [number, number]) => {
			return p.then(() => {
				return knex("countries_languages").insert({
					country_id: countryId,
					language_id: languageId
				});
			});
		}, Promise.resolve()).then(() => {
			return knex("countries_languages").select(["country_id", "language_id"]).then((rows) => {
				return rows.map((row) => {
					let country: Country = countries.find((c) => c.id === row.country_id)!;
					let language: Language = languages.find((l) => l.id === row.language_id)!;
					country.languages.push(language);
					language.countries.push(country);

					return {
						countryId: country.id,
						languageId: language.id
					} as CountriesLanguagesJoin;
				});
			});
		});
	});

	return Promise.all([
		continentsPromise,
		languagesPromise,
		countriesPromise,
		statesPromise,
		citiesPromise,
		countriesLanguagesJoinsPromise
	]).then(([continents, languages, countries, states, cities, countriesLanguagesJoins]) => {
		return {
			continents: continents,
			languages: languages,
			countries: countries,
			states: states,
			cities: cities,
			countriesLanguagesJoins: countriesLanguagesJoins
		};
	});
}

function randomString(): string {
	return Math.floor(Number.MAX_SAFE_INTEGER * Math.random()).toString(36)
}
function randomArrayValue<T>(arr: T[]): T {
	let i: number = Math.floor(arr.length * Math.random());
	return arr[i];
}
