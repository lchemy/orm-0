import * as Knex from "knex";

import { knex } from "../../config/knex";
import { AndFilterGroup, EqualFilterNode, Field, Filter, OrFilterGroup, Orm, OrmProperties } from "../../core";
import { AttachFilterMode, attachFilter } from "./attach-filter";
import { executeFind } from "./execute-find";

// TODO: can we merge this with execute update?

export function executeRemove(orm: Orm, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	// check if filter contains joins, if so, need to rewrite query
	let isJoinedRemove: boolean = filter.fields.some((field) => {
		return field.orm !== orm;
	});

	if (isJoinedRemove) {
		return executeJoinedRemove(orm, filter, trx);
	}

	return executeSimpleRemove(orm, filter, trx);
}

function executeSimpleRemove(orm: Orm, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		table: string = ormProperties.table;

	return executeRawRemove(table, filter, trx);
}

function executeJoinedRemove(orm: Orm, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		table: string = ormProperties.table,
		primaryKey: Field<Orm, string | number> | undefined = ormProperties.primaryKey;

	if (primaryKey == null) {
		return executeUnkeyedJoinedRemove(orm, filter, trx);
	}

	return executeFind(orm, {
		fields: [
			primaryKey!
		],
		filter: filter,
		pagination: {
			limit: null
		}
	}, trx).then((rows: Object[]) => {
		let ids: Array<string | number> = rows.map((row) => primaryKey!.mapper(row));
		return executeRawRemove(table, primaryKey!.in(...ids), trx);
	});
}

function executeUnkeyedJoinedRemove(orm: Orm, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		table: string = ormProperties.table,
		fields: Array<Field<Orm, any>> = Array.from(ormProperties.fields);

	console.warn(`Attempting to execute remove with joins for '${ table }' with no primary key defined.`);

	return executeFind(orm, {
		fields: fields,
		filter: filter,
		pagination: {
			limit: null
		}
	}, trx).then((rows: Object[]) => {
		let rowExpressions: AndFilterGroup[] = rows.map((row) => {
			let fieldExpressions: Array<EqualFilterNode<any>> = fields.map((field) => {
				return field.eq(field.mapper(row));
			});
			return new AndFilterGroup(fieldExpressions);
		});
		let unkeyedFilter: OrFilterGroup = new OrFilterGroup(rowExpressions);

		return executeRawRemove(table, unkeyedFilter, trx);
	});
}

function executeRawRemove(table: string, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let deleteQuery: Knex.QueryBuilder = knex.del().from(table);

	if (trx != null) {
		deleteQuery.transacting(trx);
	}
	attachFilter(deleteQuery, filter, AttachFilterMode.WHERE);

	return deleteQuery.then((res) => res) as any as Promise<number>;
}
