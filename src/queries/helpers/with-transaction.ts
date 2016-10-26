import * as Knex from "knex";

import { knex } from "../../config/knex";

export function withTransaction<T>(callback: (trx: Knex.Transaction) => Promise<T>, trx?: Knex.Transaction): Promise<T> {
	if (trx != null) {
		return callback(trx);
	}

	// TODO: bluebird is not happy
	return knex.transaction(callback) as any as Promise<T>;
}
