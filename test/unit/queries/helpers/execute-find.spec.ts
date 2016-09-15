import { expect } from "chai";
// import { Tracker, getTracker, mock, unmock } from "mock-knex";

import { SortDirection } from "../../../../src/core";
import { executeFind } from "../../../../src/queries/helpers/execute-find";
import { knex } from "../../fixtures/knex";

import {
	City, CityOrm, Continent, Country, CountryOrm, Data, Language, LanguageOrm, State, StateOrm,
	createTables, definitions, deleteTables, mockData
} from "../../fixtures/geo-data";

describe("execute find", () => {
	let queryCount: number;
	let queryListener: () => void = () => {
		queryCount++;
	};
	let data: Data;
	let idMaps: {
		continents: { [id: number]: Continent },
		countries: { [id: number]: Country },
		states: { [id: number]: State },
		cities: { [id: number]: City },
		languages: { [id: number]: Language }
	};

	before(() => {
		queryCount = 0;
		return createTables().then(mockData).then((out) => {
			data = out;
			idMaps = ["continents", "countries", "states", "cities", "languages"].reduce((memo, key) => {
				memo[key] = out[key].reduce((pad, item) => {
					pad[item.id] = item;
					return pad;
				}, {});
				return memo;
			}, {}) as any;
			knex.on("query", queryListener);
		});
	});
	beforeEach(() => {
		queryCount = 0;
	});
	after(() => {
		(knex as any).removeListener("query", queryListener);
		return deleteTables();
	});

	it("should select continents with default fields", () => {
		return definitions.then(({ continentOrm }) => {
			return executeFind(continentOrm).then((continents: Object[]) => {
				expect(queryCount).to.eq(1);
				expect(continents).to.be.instanceof(Array);

				expect(continents.length).to.eq(data.continents.length);
				continents.forEach((continent) => {
					expect(continent).to.have.all.keys(["id", "name"]);
				});
			});
		});
	});

	it("should select continents with selected fields", () => {
		return definitions.then(({ continentOrm }) => {
			return executeFind(continentOrm, {
				fields: [
					continentOrm.id,
					continentOrm.name
				]
			}).then((continents: Continent[]) => {
				expect(queryCount).to.eq(1);

				expect(continents.length).to.eq(data.continents.length);
				continents.forEach((continent) => {
					expect(continent).to.have.all.keys(["id", "name"]);
				});
			});
		});
	});

	it("should select countries with related orms' default fields", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name,
					countryOrm.continent,
					countryOrm.states
				]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(2);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name", "continent", "states"]);
					expect(country.continent).to.have.all.keys(["id", "name"]);

					country.states.forEach((state) => {
						expect(state).to.have.all.keys(["id", "name", "country", "countryId"]);
					});
				});
			});
		});
	});

	it("should select countries with composite fields", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name,
					countryOrm.metrics
				]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(1);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name", "metrics"]);
					expect(country.metrics).to.have.all.keys(["population", "gdp"]);
				});
			});
		});
	});

	it("should select countries sorted by name with default sort", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name
				],
				sorts: [
					countryOrm.name
				]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(1);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name"]);
				});

				let names: string[] = countries.map((country) => country.name);
				expect(names).to.deep.eq(names.slice().sort());
			});
		});
	});

	it("should select countries sorted by name descending", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name
				],
				sorts: [{
					field: countryOrm.name,
					direction: SortDirection.DESCENDING
				}]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(1);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name"]);
				});

				let names: string[] = countries.map((country) => country.name);
				expect(names).to.deep.eq(names.slice().sort((a, b) => a > b ? -1 : 1));
			});
		});
	});

	it("should select countries sorted by continent id", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name,
					countryOrm.continentId
				],
				sorts: [{
					field: countryOrm.continentId
				}]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(1);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name", "continentId"]);
				});

				let continentIds: number[] = countries.map((country) => country.continentId);
				expect(continentIds).to.deep.eq(continentIds.slice().sort());
			});
		});
	});

	it("should select countries with child states", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name,
					countryOrm.states.orm.id,
					countryOrm.states.orm.name,
					countryOrm.states.orm.countryId
				]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(2);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name", "states"]);

					country.states.forEach((state) => {
						expect(state).to.have.all.keys(["id", "name", "countryId"]);
						expect(state.countryId).to.eq(country.id);
					});
				});
			});
		});
	});

	it("should select continents with child countries, grandchild states, greatgrandchild cities", () => {
		return definitions.then(({ continentOrm }) => {
			return executeFind(continentOrm, {
				fields: [
					continentOrm.id,
					continentOrm.name,
					continentOrm.countries.orm.id,
					continentOrm.countries.orm.name,
					continentOrm.countries.orm.continentId,
					continentOrm.countries.orm.states.orm.id,
					continentOrm.countries.orm.states.orm.name,
					continentOrm.countries.orm.states.orm.countryId,
					continentOrm.countries.orm.states.orm.cities.orm.id,
					continentOrm.countries.orm.states.orm.cities.orm.name,
					continentOrm.countries.orm.states.orm.cities.orm.stateId
				]
			}).then((continents: Continent[]) => {
				expect(queryCount).to.eq(4);

				expect(continents.length).to.eq(data.continents.length);
				continents.forEach((continent) => {
					expect(continent).to.have.all.keys(["id", "name", "countries"]);

					expect(continent.countries.length).to.eq(idMaps.continents[continent.id].countries.length);
					continent.countries.forEach((country) => {
						expect(country).to.have.all.keys(["id", "name", "states", "continentId"]);

						expect(country.continentId).to.eq(continent.id);
						expect(country.states.length).to.eq(idMaps.countries[country.id].states.length);
						country.states.forEach((state) => {
							expect(state).to.have.all.keys(["id", "name", "cities", "countryId"]);

							expect(state.countryId).to.eq(country.id);
							expect(state.cities.length).to.eq(idMaps.states[state.id].cities.length);
							state.cities.forEach((city) => {
								expect(city).to.have.all.keys(["id", "name", "stateId"]);
								expect(city.stateId).to.eq(state.id);
							});
						});
					});
				});
			});
		});
	});

	it("should filter states", () => {
		return definitions.then(({ stateOrm }) => {
			return executeFind(stateOrm, {
				fields: [
					stateOrm.id,
					stateOrm.name
				],
				filter: stateOrm.name.like("%1%")
			}).then((states: State[]) => {
				expect(queryCount).to.eq(1);
				states.forEach((state) => {
					expect(state.name).to.contain("1");
				});

				let stateMap: { [id: number]: State } = states.reduce((memo, state) => {
					memo[state.id] = state;
					return memo;
				}, {});

				expect(data.states.every((state) => {
					return (stateMap[state.id] != null) === (!!~state.name.indexOf("1"));
				})).to.be.true;
			});
		});
	});

	it("should filter states by parent country", () => {
		return definitions.then(({ stateOrm }) => {
			return executeFind(stateOrm, {
				fields: [
					stateOrm.id,
					stateOrm.name,
					stateOrm.country.id,
					stateOrm.country.name
				],
				filter: stateOrm.country.name.like("%1%")
			}).then((states: any[]) => {
				expect(queryCount).to.eq(1);
				states.forEach((state) => {
					expect(state.country.name).to.contain("1");
				});

				let stateMap: { [id: number]: State } = states.reduce((memo, state) => {
					memo[state.id] = state;
					return memo;
				}, {});

				expect(data.states.every((state) => {
					return (stateMap[state.id] != null) === (!!~state.country.name.indexOf("1"));
				})).to.be.true;
			});
		});
	});

	it("should filter states by child city", () => {
		return definitions.then(({ stateOrm }) => {
			return executeFind(stateOrm, {
				fields: [
					stateOrm.id,
					stateOrm.name,
					stateOrm.cities.orm.id,
					stateOrm.cities.orm.name
				],
				filter: stateOrm.cities.exists((city: CityOrm, state: StateOrm) => {
					return city.name.like("%1%");
				})
			}).then((states: any[]) => {
				expect(queryCount).to.eq(2);
				states.forEach((state) => {
					expect(state.cities.some((city) => !!~city.name.indexOf("1"))).to.be.true;
				});

				let stateMap: { [id: number]: State } = states.reduce((memo, state) => {
					memo[state.id] = state;
					return memo;
				}, {});

				expect(data.states.every((state) => {
					return (stateMap[state.id] != null) === state.cities.some((city) => !!~city.name.indexOf("1"));
				})).to.be.true;
			});
		});
	});

	it("should select countries with languages through a join table", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name,
					countryOrm.languages.orm.id,
					countryOrm.languages.orm.name,
					countryOrm.languages.orm.countries.orm.id,
					countryOrm.languages.orm.countries.orm.name
				]
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(3);

				expect(countries.length).to.eq(data.countries.length);
				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name", "languages"]);

					expect(country.languages.length).to.eq(idMaps.countries[country.id].languages.length);
					country.languages.forEach((language) => {
						expect(language).to.have.all.keys(["id", "name", "countries"]);

						expect(language.countries.some((c) => c.id === country.id)).to.be.true;
					});
				});
			});
		});
	});

	it("should filter countries with languages through a join table", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm.id,
					countryOrm.name,
					countryOrm.languages.orm.id,
					countryOrm.languages.orm.name
				],
				filter: countryOrm.languages.exists((language: LanguageOrm, country: CountryOrm) => {
					return language.name.like("%1%");
				})
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(2);

				countries.forEach((country) => {
					expect(country).to.have.all.keys(["id", "name", "languages"]);

					expect(country.languages.length).to.eq(idMaps.countries[country.id].languages.length);

					expect(country.languages.some((l) => !!~l.name.indexOf("1"))).to.be.true;
				});
			});
		});
	});

	it("should select cities with default pagination", () => {
		return definitions.then(({ cityOrm }) => {
			return executeFind(cityOrm).then((cities: City[]) => {
				expect(queryCount).to.eq(1);
				expect(cities.length).to.eq(50);
			});
		});
	});

	it("should select cities with pagination", () => {
		return definitions.then(({ cityOrm }) => {
			return Promise.all(Array(10).fill(undefined).map((_, i) => {
				return executeFind(cityOrm, {
					pagination: {
						offset: i * 10,
						limit: 10
					}
				});
			})).then((pages: City[][]) => {
				let cityIds: Set<number> = new Set();

				expect(pages.length).to.eq(10);
				pages.forEach((cities) => {
					expect(cities.length).to.eq(10);
					cities.forEach((city) => {
						expect(cityIds.has(city.id)).to.be.false;
						cityIds.add(city.id);
					});
				});
			});
		});
	});

	it("should select count of cities", () => {
		return definitions.then(({ cityOrm }) => {
			return executeFind(cityOrm, {
				count: true
			}).then((count: number) => {
				expect(queryCount).to.eq(1);
				expect(count).to.eq(data.cities.length);
			});
		});
	});

	it("should not make join many queries if base result is empty", () => {
		return definitions.then(({ countryOrm }) => {
			return executeFind(countryOrm, {
				fields: [
					countryOrm,
					countryOrm.states,
					countryOrm.states.orm.cities
				],
				filter: countryOrm.id.eq(-1)
			}).then((countries: Country[]) => {
				expect(queryCount).to.eq(1);
				expect(countries).to.have.length(0);
			});
		});
	});
});
