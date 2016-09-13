import * as Knex from "knex";

export let knex: Knex;

export function config(conf: Knex.Config): Knex {
	knex = Knex(conf);
	return knex;
}
