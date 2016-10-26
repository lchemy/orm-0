import * as Knex from "knex";

import { knex } from "../config/knex";
import { Field, Orm } from "../core";
import { getOrm, withTransaction } from "./helpers";

// TODO: make it take a type for models?
export function insert<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => Field<O, any>[],
	models: Object[],
	trx?: Knex.Transaction
): Promise<number[]> {
	if (models.length === 0) {
		return Promise.resolve([]);
	}

	return getOrm(ref).then((orm) => {
		let table: string = Orm.getProperties(orm).table,
			fields: Field<O, any>[] = builder(orm);

		// TODO: validations and etc.
		let data: Object[] = models.map((model) =>
			fields.reduce((memo, field) => {
				memo[field.column] = field.mapper(model);
				return memo;
			}, {})
		);

		return withTransaction((tx) => {
			return tx.insert(data).into(table).then(() => {
				return tx.select([
					knex.raw("LAST_INSERT_ID() AS lastId"),
					knex.raw("ROW_COUNT() AS inserts")
				]);
			}).then((res) => {
				let lastId: number = res[0].lastId,
					inserts: number = res[0].inserts;
				return Array(inserts).fill(undefined).map((v, i) => lastId + i);
			}) as any as Promise<number[]>;
		}, trx);
	});
}

export function insertOne<O extends Orm, M extends Object>(
	ref: string | symbol | O,
	builder: (orm: O) => Field<O, any>[],
	model: Object,
	trx?: Knex.Transaction
): Promise<number> {
	return insert(ref, builder, [model], trx).then((res) => res[0]);
}
