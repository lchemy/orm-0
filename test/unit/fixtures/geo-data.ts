import { Orm, define, field, join } from "../../../src";
import { knex } from "./knex";

const ID: number = (Math.random() * (~(1 << 31))) | 0;

export interface Continent {
	id: number;
	name: string;

	countries: Country[];
}
export interface Country {
	id: number;
	name: string;
	metrics: {
		population: number,
		gdp: number
	};

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

	parent: {
		stateId: number,
		state: State
	};
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

export interface AuthUser {
	isAdmin: boolean;
	allowedContinentIds?: number[];
	allowedCountryIds?: number[];
}

export interface ContinentOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	countries: join.Many<CountryOrm>;
}
export interface CountryOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	metrics: {
		population: field.Numerical,
		gdp: field.Numerical
	};

	continentId: field.Numerical;
	continent: join.One<ContinentOrm>;

	states: join.Many<StateOrm>;
	languages: join.Many<LanguageOrm>;
}
export interface StateOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	countryId: field.Numerical;
	country: join.One<CountryOrm>;

	cities: join.Many<CityOrm>;
}
export interface CityOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	parent: {
		stateId: field.Numerical,
		state: join.One<StateOrm>
	};
}

export interface LanguageOrm extends Orm {
	id: field.primary.Numerical;
	name: field.String;

	countries: join.Many<CountryOrm>;
}
export interface CountriesLanguagesJoinOrm extends Orm {
	countryId: field.Numerical;
	languageId: field.Numerical;
}

export interface Definitions {
	continentOrm: ContinentOrm;
	countryOrm: CountryOrm;
	stateOrm: StateOrm;
	cityOrm: CityOrm;
	languageOrm: LanguageOrm;
	countriesLanguagesJoinOrm: CountriesLanguagesJoinOrm;
}

export const definitions: Promise<Definitions> = Promise.all([
	define<ContinentOrm, AuthUser>({
		ref: "continents",
		table: `continents_${ ID }`
	}, (field, join) => {
		return {
			id: field.primary.Numerical("id"),
			name: field.String("name"),

			countries: join.Many<CountryOrm>("countries", false).on((country, continent) => {
				// the isNotNull part is unnecessary but here to exercise hydration
				return country.continentId.eq(continent.id).and(country.continentId.isNotNull()).and(continent.id.isNotNull());
			}).withAuth<AuthUser>((auth, country) => {
				if (auth.isAdmin || auth.allowedCountryIds == null) {
					return;
				}
				return country.id.in(...auth.allowedCountryIds);
			})
		};
	}, (auth, continent) => {
		if (auth.isAdmin || auth.allowedContinentIds == null) {
			return;
		}
		return continent.id.in(...auth.allowedContinentIds);
	}),
	define<CountryOrm, AuthUser>({
		ref: "countries",
		table: `countries_${ ID }`
	}, (field, join) => {
		return {
			id: field.primary.Numerical("id"),
			name: field.String("name"),
			metrics: {
				population: field.Numerical("population"),
				gdp: field.Numerical("gdp")
			},

			continentId: field.Numerical("continent_id", undefined, "continent.id"),
			continent: join.One<ContinentOrm>("continents", true).on((country, continent) => {
				return country.continentId.eq(continent.id);
			}),

			states: join.Many<StateOrm>("states", false).on((state, country) => {
				return state.countryId.eq(country.id);
			}),
			languages: join.Many<LanguageOrm>("languages", false).through<CountriesLanguagesJoinOrm>("countries_languages", (language, countriesLanguagesJoin) => {
				return countriesLanguagesJoin.languageId.eq(language.id);
			}).on((_, countriesLanguagesJoin, country) => {
				return countriesLanguagesJoin.countryId.eq(country.id);
			})
		};
	}, (auth, country) => {
		if (auth.isAdmin || auth.allowedCountryIds == null) {
			return;
		}
		return country.id.in(...auth.allowedCountryIds);
	}),
	define<StateOrm>({
		ref: "states",
		table: `states_${ ID }`
	}, (field, join) => {
		return {
			// purposely not marked as primary for testing
			id: field.Numerical("id"),
			name: field.String("name"),

			countryId: field.Numerical("country_id", undefined, "country.id"),
			country: join.One<CountryOrm>("countries", true).on((state, country) => {
				return state.countryId.eq(country.id);
			}),

			cities: join.Many<CityOrm>("cities").on((city, state) => {
				return city.parent.stateId.eq(state.id);
			})
		};
	}),
	define<CityOrm>({
		ref: "cities",
		table: `cities_${ ID }`
	}, (field, join) => {
		return {
			id: field.primary.Numerical("id"),
			name: field.String("name"),

			parent: {
				stateId: field.Numerical("state_id", undefined, "parent.state.id"),
				state: join.One<StateOrm>("states", true).on((city, state) => {
					return city.parent.stateId.eq(state.id);
				})
			}
		};
	}),
	define<LanguageOrm>({
		ref: "languages",
		table: `languages_${ ID }`
	}, (field, join) => {
		return {
			id: field.primary.Numerical("id"),
			name: field.String("name"),

			countries: join.Many<CountryOrm>("countries").through<CountriesLanguagesJoinOrm>("countries_languages", (country, countriesLanguagesJoin) => {
				return countriesLanguagesJoin.countryId.eq(country.id);
			}).on((_, countriesLanguagesJoin, language) => {
				return countriesLanguagesJoin.languageId.eq(language.id);
			})
		};
	}),
	define<CountriesLanguagesJoinOrm>({
		ref: "countries_languages",
		table: `countries_languages_${ ID }`
	}, (field) => {
		return {
			countryId: field.Numerical("country_id"),
			languageId: field.String("language_id")
		};
	})
]).then(([continentOrm, countryOrm, stateOrm, cityOrm, languageOrm, countriesLanguagesJoinOrm]) => {
	return {
		continentOrm,
		countryOrm,
		stateOrm,
		cityOrm,
		languageOrm,
		countriesLanguagesJoinOrm
	};
});

export function createTables(): Promise<any> {
	return Promise.all([
		knex.raw(`
			CREATE TEMPORARY TABLE continents_${ ID } (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE countries_${ ID } (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				continent_id INTEGER,
				name STRING,
				population INTEGER,
				gdp INTEGER
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE states_${ ID } (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				country_id INTEGER,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE cities_${ ID } (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				state_id INTEGER,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE languages_${ ID } (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name STRING
			);
		`),
		knex.raw(`
			CREATE TEMPORARY TABLE countries_languages_${ ID } (
				country_id INTEGER,
				language_id INTEGER,
				CONSTRAINT country_language_unique UNIQUE (country_id, language_id)
			);
		`)
	]);
}

export function clearData(): Promise<any> {
	return Promise.all([
		knex.raw(`
			DELETE FROM countries_languages_${ ID };
		`)
	]).then(() => {
		return Promise.all([
			knex.raw(`
				DELETE FROM continents_${ ID };
			`),
			knex.raw(`
				DELETE FROM countries_${ ID };
			`),
			knex.raw(`
				DELETE FROM states_${ ID };
			`),
			knex.raw(`
				DELETE FROM cities_${ ID };
			`),
			knex.raw(`
				DELETE FROM languages_${ ID };
			`)
		]);
	});
}

export function deleteTables(): Promise<any> {
	return Promise.all([
		knex.raw(`
			DROP TABLE IF EXISTS continents_${ ID };
		`),
		knex.raw(`
			DROP TABLE IF EXISTS countries_${ ID };
		`),
		knex.raw(`
			DROP TABLE IF EXISTS states_${ ID };
		`),
		knex.raw(`
			DROP TABLE IF EXISTS cities_${ ID };
		`),
		knex.raw(`
			DROP TABLE IF EXISTS languages_${ ID };
		`),
		knex.raw(`
			DROP TABLE IF EXISTS countries_languages_${ ID };
		`)
	]);
}

export interface Data {
	continents: Continent[];
	countries: Country[];
	states: State[];
	cities: City[];
	languages: Language[];
	countriesLanguagesJoins: CountriesLanguagesJoin[];
}

export function mockData(): Promise<Data> {
	let continentsPromise: Promise<Continent[]> = Array(6).fill(undefined).reduce((p) => {
		return p.then(() => {
			return knex(`continents_${ ID }`).insert({
				name: randomString()
			});
		});
	}, Promise.resolve()).then(() => {
		return knex(`continents_${ ID }`).select(["id", "name"]).then((rows) => {
			return rows.map((row) => {
				return {
					id: row.id,
					name: row.name,

					countries: []
				} as Continent;
			});
		});
	});

	let languagesPromise: Promise<Language[]> = Array(10).fill(undefined).reduce((p) => {
		return p.then(() => {
			return knex(`languages_${ ID }`).insert({
				name: randomString()
			});
		});
	}, Promise.resolve()).then(() => {
		return knex(`languages_${ ID }`).select(["id", "name"]).then((rows) => {
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
		return continents.reduce((p, continent) => {
			return Array((Math.random() * 5 + 1) | 0).fill(undefined).reduce((q) => {
				return q.then(() => {
					return knex(`countries_${ ID }`).insert({
						continent_id: continent.id,
						name: randomString(),
						population: (Math.random() * 10000 + 1000) | 0,
						gdp: (Math.random() * 100000 + 100) | 0
					});
				});
			}, p);
		}, Promise.resolve()).then<Country[]>(() => {
			return knex(`countries_${ ID }`).select(["id", "name", "population", "gdp", "continent_id"]).then((rows) => {
				return rows.map((row) => {
					let continent: Continent = continents.find((c) => c.id === row.continent_id)!;
					let country: Country = {
						id: row.id,
						name: row.name,
						metrics: {
							population: row.population,
							gdp: row.gdp
						},
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
		return countries.reduce((p, country) => {
			return Array((Math.random() * 10 + 1) | 0).fill(undefined).reduce((q) => {
				return q.then(() => {
					return knex(`states_${ ID }`).insert({
						country_id: country.id,
						name: randomString()
					});
				});
			}, p);
		}, Promise.resolve()).then<State[]>(() => {
			return knex(`states_${ ID }`).select(["id", "name", "country_id"]).then((rows) => {
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
		return states.reduce((p, state) => {
			return Array((Math.random() * 10 + 1) | 0).fill(undefined).reduce((q) => {
				return q.then(() => {
					return knex(`cities_${ ID }`).insert({
						state_id: state.id,
						name: randomString()
					});
				});
			}, p);
		}, Promise.resolve()).then<City[]>(() => {
			return knex(`cities_${ ID }`).select(["id", "name", "state_id"]).then((rows) => {
				return rows.map((row) => {
					let state: State = states.find((s) => s.id === row.state_id)!;
					let city: City = {
						id: row.id,
						name: row.name,
						parent: {
							stateId: row.state_id,
							state: state
						}
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
		return Array(countries.length * 3).fill(undefined).reduce((memo) => {
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
			pairs: Array<[number, number]>,
			set: { [key: string]: boolean }
		}).pairs.reduce((p, [countryId, languageId]: [number, number]) => {
			return p.then(() => {
				return knex(`countries_languages_${ ID }`).insert({
					country_id: countryId,
					language_id: languageId
				});
			});
		}, Promise.resolve()).then(() => {
			return knex(`countries_languages_${ ID }`).select(["country_id", "language_id"]).then((rows) => {
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
	return Math.floor(Number.MAX_SAFE_INTEGER * Math.random()).toString(36);
}
function randomArrayValue<T>(arr: T[]): T {
	let i: number = Math.floor(arr.length * Math.random());
	return arr[i];
}
