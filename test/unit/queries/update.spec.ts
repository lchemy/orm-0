import { expect } from "chai";
import * as sinon from "sinon";
// import { Tracker, getTracker, mock, unmock } from "mock-knex";

import { findAll } from "../../../src/queries/find";
import { update, updateModel, updateModels } from "../../../src/queries/update";
import { knex } from "../fixtures/knex";

import {
	City, CityOrm, Continent, ContinentOrm, Country, CountryOrm, Data, Language, LanguageOrm, State, StateOrm,
	createTables, deleteTables, mockData
} from "../fixtures/geo-data";

describe("update queries", () => {
	let data: Data;
	let idMaps: {
		continents: { [id: number]: Continent },
		countries: { [id: number]: Country },
		states: { [id: number]: State },
		cities: { [id: number]: City },
		languages: { [id: number]: Language }
	};

	beforeEach(() => {
		return createTables().then(mockData).then((out) => {
			data = out;
			idMaps = ["continents", "countries", "states", "cities", "languages"].reduce((memo, key) => {
				memo[key] = out[key].reduce((pad, item) => {
					pad[item.id] = item;
					return pad;
				}, {});
				return memo;
			}, {}) as any;
		});
	});
	afterEach(() => {
		return deleteTables();
	});

	it("should update with simple filter", () => {
		return update<CityOrm>("cities", (city) => {
			return {
				fields: [
					city.name
				],
				filter: city.name.gt("c")
			};
		}, {
			name: "new city name"
		}).then((count) => {
			let expectedCities: City[] = data.cities.filter((city) => city.name > "c");
			expect(count).to.eq(expectedCities.length);

			let updatedCityIds: number[] = expectedCities.map((city) => city.id);
			return findAll<CityOrm>("cities", (city) => {
				return {
					fields: [
						city.name
					],
					filter: city.id.in(...updatedCityIds)
				};
			});
		}).then((cities: City[]) => {
			cities.forEach((city) => {
				expect(city.name).to.eq("new city name");
			});
		});
	});

	it("should update with join", () => {
		return update<CityOrm>("cities", (city) => {
			return {
				fields: [
					city.name
				],
				filter: city.parent.state.country.name.gt("d")
			};
		}, {
			name: "new city name"
		}).then((count) => {
			let expectedCities: City[] = data.countries.filter((country) => country.name > "d").reduce<City[]>((memo, country) => {
				country.states.forEach((state) => {
					memo = memo.concat(state.cities);
				});
				return memo;
			}, []);
			expect(count).to.eq(expectedCities.length);

			let updatedCityIds: number[] = expectedCities.map((city) => city.id);
			return findAll<CityOrm>("cities", (city) => {
				return {
					fields: [
						city.name
					],
					filter: city.id.in(...updatedCityIds)
				};
			});
		}).then((cities: City[]) => {
			cities.forEach((city) => {
				expect(city.name).to.eq("new city name");
			});
		});
	});

	it("should update with unkeyed join and provide a warning", () => {
		let sandbox: sinon.SinonSandbox = sinon.sandbox.create(),
			consoleWarnStub: sinon.SinonStub = sandbox.stub(console, "warn");

		return update<StateOrm>("states", (state) => {
			return {
				fields: [
					state.name
				],
				filter: state.country.name.gt("d")
			};
		}, {
			name: "new state name"
		}).then((count) => {
			let expectedStates: State[] = data.countries.filter((country) => country.name > "d").reduce<State[]>((memo, country) => {
				memo = memo.concat(country.states);
				return memo;
			}, []);
			expect(count).to.eq(expectedStates.length);

			let updatedStateIds: number[] = expectedStates.map((state) => state.id);
			return findAll<StateOrm>("states", (state) => {
				return {
					fields: [
						state.name
					],
					filter: state.id.in(...updatedStateIds)
				};
			});
		}).then((states: State[]) => {
			states.forEach((state) => {
				expect(state.name).to.eq("new state name");
			});
		}).then(() => {
			expect(consoleWarnStub).to.have.been.calledWithMatch(/Attempting to execute update with joins for .*? with no primary key defined./);

			sandbox.restore();
		}, (err) => {
			sandbox.restore();
			throw err;
		});
	});

	it("should update with raw", () => {
		return update<CityOrm>("cities", (city) => {
			return {
				fields: [
					city.name
				],
				filter: city.name.gt(knex.raw("'c'"))
			};
		}, {
			name: knex.raw("'new city name'")
		}).then((count) => {
			let expectedCities: City[] = data.cities.filter((city) => city.name > "c");
			expect(count).to.eq(expectedCities.length);

			let updatedCityIds: number[] = expectedCities.map((city) => city.id);
			return findAll<CityOrm>("cities", (city) => {
				return {
					fields: [
						city.name
					],
					filter: city.id.in(...updatedCityIds)
				};
			});
		}).then((cities: City[]) => {
			cities.forEach((city) => {
				expect(city.name).to.eq("new city name");
			});
		});
	});

	it("should update with auth", () => {
		// TODO
	});

	it("should update with joins and auth", () => {
		// TODO
	});

	it("should update models", () => {
		// TODO
	});

	it("should update model", () => {
		// TODO
	});

	// temporary trash
	// tslint:disable-next-line
	updateModel; updateModels; let a: ContinentOrm | undefined; let b: CountryOrm | undefined; let c: LanguageOrm | undefined; void a; void b; void c;
});
