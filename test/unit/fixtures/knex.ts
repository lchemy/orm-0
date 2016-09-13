import { config } from "../../../src/config/knex";

config({
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

export { knex } from "../../../src/config/knex";
