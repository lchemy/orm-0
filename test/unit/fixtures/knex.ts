import * as Knex from "knex";

import { config } from "../../../src";

export let knex: Knex = config({
	client: "sqlite3",
	connection: {
		filename: ":memory:",
		debug: true
	},
	pool: {
		min: 1,
		max: 1
	},
	useNullAsDefault: true,
	debug: false
});
