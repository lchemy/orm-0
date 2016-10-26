import * as Knex from "knex";

import { BoundedOrmAuthBuilder, Field, Filter, Orm, OrmProperties } from "../core";
import { AttachFilterMode, attachFilter, getOrm, withTransaction } from "./helpers";

export interface UpdateQuery<O extends Orm> {
	fields: Field<O, any>[];
	filter: Filter;
}

export function update<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => UpdateQuery<O>,
	model: Object,
	auth?: any,
	trx?: Knex.Transaction
): Promise<number> {
	return getOrm(ref).then((orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			table: string = ormProperties.table,
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			query: UpdateQuery<O> = builder(orm);

		// TODO: validations and etc.
		let data: { [key: string]: any } = query.fields.reduce((memo, field) => {
			memo[field.column] = field.mapper(model);
			return memo;
		}, {});

		let filter: Filter = query.filter;
		if (authBuilder != null && auth != null) {
			let authFilter: Filter | undefined = authBuilder(auth);
			if (authFilter != null) {
				filter = filter.and(authFilter);
			}
		}

		return withTransaction((tx) => {
			let updateQuery: Knex.QueryBuilder = tx.update(data).table(`${ table } AS root`);
			attachFilter(updateQuery, filter, AttachFilterMode.WHERE);
			return updateQuery.then((res) => res) as any as Promise<number>;
		}, trx);
	});
}
