import * as Knex from "knex";

import { knex } from "../../config/knex";
import { AndFilterGroup, EqualFilterNode, Field, Filter, OrFilterGroup, Orm, OrmProperties } from "../../core";
import { AttachFilterMode, attachFilter } from "./attach-filter";
import { executeFind } from "./execute-find";

export interface UpdateData {
	[key: string]: any;
}

export function executeUpdate(orm: Orm, data: UpdateData, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	// TODO: check fields are all part of orm and not joins, sanity check

	// check if filter contains joins, if so, need to rewrite query
	let isJoinedUpdate: boolean = filter.fields.some((field) => {
		return field.orm !== orm;
	});

	if (isJoinedUpdate) {
		return executeJoinedUpdate(orm, data, filter, trx);
	}

	return executeSimpleUpdate(orm, data, filter, trx);
}

function executeSimpleUpdate(orm: Orm, data: UpdateData, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		table: string = ormProperties.table;

	return executeRawUpdate(table, data, filter, trx);
}

function executeJoinedUpdate(orm: Orm, data: UpdateData, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		table: string = ormProperties.table,
		primaryKey: Field<Orm, string | number> | undefined = ormProperties.primaryKey;

	if (primaryKey == null) {
		return executeUnkeyedJoinedUpdate(orm, data, filter, trx);
	}

	return executeFind(orm, {
		fields: [
			primaryKey!,
			(orm as any).name
		],
		filter: filter,
		pagination: {
			limit: null
		}
	}, trx).then((rows: Object[]) => {
		let ids: Array<string | number> = rows.map((row) => primaryKey!.mapper(row));
		return executeRawUpdate(table, data, primaryKey!.in(...ids), trx);
	});
}

function executeUnkeyedJoinedUpdate(orm: Orm, data: UpdateData, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		table: string = ormProperties.table,
		fields: Array<Field<Orm, any>> = Array.from(ormProperties.fields);

	console.warn(`Attempting to execute update with joins for '${ table }' with no primary key defined.`);

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

		return executeRawUpdate(table, data, unkeyedFilter, trx);
	});
}

function executeRawUpdate(table: string, data: UpdateData, filter: Filter, trx?: Knex.Transaction): Promise<number> {
	let updateQuery: Knex.QueryBuilder = knex.update(data).table(table);

	if (trx != null) {
		updateQuery.transacting(trx);
	}
	attachFilter(updateQuery, filter, AttachFilterMode.WHERE);

	return updateQuery.then((res) => res) as any as Promise<number>;
}
