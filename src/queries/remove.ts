import * as Knex from "knex";

import { knex } from "../config/knex";
import { BoundedOrmAuthBuilder, Filter, Orm, OrmProperties } from "../core";
import { AttachFilterMode, attachFilter, getOrm, withTransaction } from "./helpers";

export function remove<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => Filter,
	auth?: any,
	trx?: Knex.Transaction
): Promise<number> {
	return getOrm(ref).then((orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			table: string = ormProperties.table,
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			filter: Filter = builder(orm);

		if (authBuilder != null && auth != null) {
			let authFilter: Filter | undefined = authBuilder(auth);
			if (authFilter != null) {
				filter = filter.and(authFilter);
			}
		}

		let removeQuery: Knex.QueryBuilder = knex.del().from(`${ table } AS root`);
		attachFilter(removeQuery, filter, AttachFilterMode.WHERE);

		// TODO: file pull request to knex to handle this case
		let sql: Knex.Sql = removeQuery.toSQL(),
			modifiedSql: string = sql.sql.replace("delete from", "delete `root` from");

		return withTransaction((tx) => {
			return (knex.raw(modifiedSql, sql.bindings) as any as Knex.QueryInterface).transacting(tx).then((res) => res[0].affectedRows) as any as Promise<number>;
		}, trx);
	});
}
