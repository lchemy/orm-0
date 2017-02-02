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
		return findAllWithCount<StateOrm>("states", () => {
			return {
				pagination: {
					limit: null
				}
			};
		}).then(({ rows: states, count }: { rows: State[], count: number }) => {
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
					city.parent.state.id,
					city.parent.state.name
				],
				filter: city.name.gt("c"),
				sorts: [{
					field: city.parent.state.id
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
				expect(city.parent.state.id).to.eq(idMaps.cities[city.id].parent.state.id);
			});
			expect(cities.every((city, i) => {
				if (i === 0) {
					return true;
				}
				if (city.parent.state.id === cities[i - 1].parent.state.id) {
					return city.name < cities[i - 1].name;
				}
				return city.parent.state.id > cities[i - 1].parent.state.id;
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

	it("should find cities by ids", () => {
		let cityIds: number[] = data.cities.filter(() => Math.random() > .25).map((city) => city.id);

		return findByIds<CityOrm>("cities", cityIds).then((cities: City[]) => {
			expect(cities.length).to.eq(cityIds.length);
			cities.forEach((city) => {
				expect(city.id).to.be.oneOf(cityIds);
			});
		});
	});

	it("should find cities by ids with specific fields", () => {
		let cityIds: number[] = data.cities.filter(() => Math.random() > .25).map((city) => city.id);

		return findByIds<CityOrm>("cities", cityIds, (city) => {
			return [
				city.id,
				city.name
			];
		}).then((cities: City[]) => {
			expect(cities.length).to.eq(cityIds.length);
			cities.forEach((city) => {
				expect(Object.keys(city)).to.have.members(["id", "name"]);
			});
		});
	});

	it("should find cities by id", () => {
		let cityId: number = data.cities.sort(() => Math.random() > .25 ? 1 : -1)[0].id;

		return findById<CityOrm>("cities", cityId).then((city: City) => {
			expect(city.id).to.eq(cityId);
		});
	});

	it("should find city by id with specific fields", () => {
		let cityId: number = data.cities.sort(() => Math.random() > .25 ? 1 : -1)[0].id;

		return findById<CityOrm>("cities", cityId, (city) => {
			return [
				city.id,
				city.name
			];
		}).then((city: City) => {
			expect(city.id).to.eq(cityId);
			expect(Object.keys(city)).to.have.members(["id", "name"]);
		});
	});

	it("should find city by raw values", () => {
		return findAll<CityOrm>("cities", (city) => {
			return {
				fields: [
					city.id,
					city.name
				],
				filter: city.name.gte(knex.raw("'e'")),
				pagination: {
					limit: null
				}
			};
		}).then((cities: City[]) => {
			let expectedCount: number = data.cities.filter((city) => {
				return city.name > "e";
			}).length;
			expect(cities.length).to.eq(expectedCount);

			cities.forEach((city) => {
				expect(city.name > "e").to.be.true;
			});
		});
	});

	it("should reject and not find city by id that doesn't exist", () => {
		return findById<CityOrm>("cities", 0).then(() => {
			expect.fail("should not be resolved");
		}).then(() => {
			expect.fail("should not be resolved");
		}).catch(() => {
			// TODO: better success?
			expect(true).to.be.true;
		});
	});
});
