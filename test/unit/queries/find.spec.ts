import { expect } from "chai";
// import { Tracker, getTracker, mock, unmock } from "mock-knex";

import { findAll, findAllWithCount, findById, findByIds, findCount, findOne } from "../../../src/queries/find";
import { knex } from "../fixtures/knex";

import {
	City, CityOrm, Continent, ContinentOrm, Country, CountryOrm, Data, Language, LanguageOrm, State, StateOrm,
	createTables, deleteTables, mockData
} from "../fixtures/geo-data";

describe("find queries", () => {
	let queryCount: number;
	let queryListener: (data: any) => void = () => {
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

	it("should find all countries", () => {
		return findAll<CountryOrm>("countries").then((countries) => {
			expect(countries.length).to.eq(data.countries.length);
		});
	});

	it("should find all states with a query builder", () => {
		return findAll<StateOrm>("states", (state) => {
			return {
				fields: [
					state.id,
					state.name,
					state.country.id,
					state.country.name
				],
				filter: state.name.gt("c"),
				sorts: [
					state.name
				],
				pagination: {
					limit: 5
				}
			};
		}).then((states: State[]) => {
			expect(states.length).to.be.lte(5);
			states.forEach((state) => {
				expect(state.name > "c").to.be.true;
				expect(state.country.id).to.eq(idMaps.states[state.id].country.id);
			});
			expect(states.every((state, i) => {
				return i === 0 || state.name > states[i - 1].name;
			})).to.be.true;
		});
	});

	it("should find one continent", () => {
		return findOne<ContinentOrm>("continents").then((continent: Continent) => {
			expect(continent.id).to.eq(data.continents[0].id);
		});
	});

	it("should find one country with a query builder", () => {
		return findOne<CountryOrm>("countries", (country) => {
			return {
				filter: country.id.gt(3)
			};
		}).then((country: Country) => {
			expect(country.id).to.eq(data.countries.find((c) => c.id > 3)!.id);
		});
	});

	it("should reject and not find one country that doesn't exist", () => {
		return findOne<CountryOrm>("countries", (country) => {
			return {
				filter: country.id.eq(0)
			};
		}).then(() => {
			expect.fail("should not be resolved");
		}).catch(() => {
			// TODO: better success?
			expect(true).to.be.true;
		});
	});

	it("should find all states with count", () => {
		return findAllWithCount<StateOrm>("states").then(({ rows: states, count }: { rows: State[], count: number }) => {
			expect(states.length).to.eq(data.states.length);
			expect(count).to.eq(data.states.length);
		});
	});

	it("should find all cities with count with a query builder", () => {
		return findAllWithCount<CityOrm>("cities", (city) => {
			return {
				fields: [
					city.id,
					city.name,
					city.state.id,
					city.state.name
				],
				filter: city.name.gt("c"),
				sorts: [{
					field: city.state.id
				}, {
					field: city.name,
					direction: "desc"
				}],
				pagination: {
					limit: 25
				}
			};
		}).then(({ rows: cities, count }: { rows: City[], count: number }) => {
			let expectedCount: number = data.cities.filter((city) => {
				return city.name > "c";
			}).length;
			expect(count).to.eq(expectedCount);

			expect(cities.length).to.be.lte(25);
			cities.forEach((city) => {
				expect(city.name > "c").to.be.true;
				expect(city.state.id).to.eq(idMaps.cities[city.id].state.id);
			});
			expect(cities.every((city, i) => {
				if (i === 0) {
					return true;
				}
				if (city.state.id === cities[i - 1].state.id) {
					return city.name < cities[i - 1].name;
				}
				return city.state.id > cities[i - 1].state.id;
			})).to.be.true;
		});
	});

	it("should find count of languages", () => {
		return findCount<LanguageOrm>("languages").then((count) => {
			expect(count).to.eq(data.languages.length);
		});
	});

	it("should find count of languages with filter builder", () => {
		return findCount<LanguageOrm>("languages", (language) => {
			return language.name.gt("f");
		}).then((count) => {
			let expectedCount: number = data.languages.filter((language) => {
				return language.name > "f";
			}).length;
			expect(count).to.eq(expectedCount);
		});
	});

	it("should find states by ids", () => {
		let stateIds: number[] = data.states.filter(() => Math.random() > .25).map((state) => state.id);

		return findByIds<StateOrm>("states", stateIds).then((states: State[]) => {
			expect(states.length).to.eq(stateIds.length);
			states.forEach((state) => {
				expect(state.id).to.be.oneOf(stateIds);
			});
		});
	});

	it("should find states by ids with specific fields", () => {
		let stateIds: number[] = data.states.filter(() => Math.random() > .25).map((state) => state.id);

		return findByIds<StateOrm>("states", stateIds, (state) => {
			return [
				state.id,
				state.name
			];
		}).then((states: State[]) => {
			expect(states.length).to.eq(stateIds.length);
			states.forEach((state) => {
				expect(Object.keys(state)).to.have.members(["id", "name"]);
			});
		});
	});

	it("should find states by id", () => {
		let stateId: number = data.states.sort(() => Math.random() > .25 ? 1 : -1)[0].id;

		return findById<StateOrm>("states", stateId).then((state: State) => {
			expect(state.id).to.eq(stateId);
		});
	});

	it("should find state by id with specific fields", () => {
		let stateId: number = data.states.sort(() => Math.random() > .25 ? 1 : -1)[0].id;

		return findById<StateOrm>("states", stateId, (state) => {
			return [
				state.id,
				state.name
			];
		}).then((state: State) => {
			expect(state.id).to.eq(stateId);
			expect(Object.keys(state)).to.have.members(["id", "name"]);
		});
	});

	it("should reject and not find state by id that doesn't exist", () => {
		return findById<StateOrm>("states", 0).then(() => {
			expect.fail("should not be resolved");
		}).then(() => {
			expect.fail("should not be resolved");
		}).catch(() => {
			// TODO: better success?
			expect(true).to.be.true;
		});
	});
});
