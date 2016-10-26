import * as Knex from "knex";

import { Field, Filter, Orm, SortDirection } from "../core";
import { FindQueryField, FindSortField, executeFind, getOrm, normalizeSortDirection } from "./helpers";

type RawFindSortField = Field<any, any> | { field: Field<any, any>, direction?: string | number | SortDirection };

export interface FindOneQuery {
	fields?: FindQueryField[];
	filter?: Filter;
}

export interface FindAllQuery extends FindOneQuery {
	sorts?: RawFindSortField[];
	pagination?: { offset?: number, limit?: number };
}

export interface FindAllWithCountResult {
	rows: Object[];
	count: number;
}

export function findOne<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => FindOneQuery,
	auth?: any,
	trx?: Knex.Transaction
): Promise<Object> {
	return getOrm(ref).then((orm) => {
		let query: FindOneQuery = builder(orm);
		return executeFind(orm, {
			fields: query.fields,
			filter: query.filter,
			auth: auth
		}, trx);
	}).then((rows: Object[]) => {
		if (rows.length === 0) {
			// TODO: no rows
			return Promise.reject(undefined);
		}
		return rows[0];
	});
}

export function findAll<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => FindAllQuery,
	auth?: any,
	trx?: Knex.Transaction
): Promise<Object[]> {
	return getOrm(ref).then((orm) => {
		let query: FindAllQuery = builder(orm);

		return executeFind(orm, {
			fields: query.fields,
			filter: query.filter,
			sorts: normalizeSorts(query.sorts),
			pagination: query.pagination,
			auth: auth
		}, trx);
	});
}

export function findCount<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => Filter,
	auth?: any,
	trx?: Knex.Transaction
): Promise<number> {
	return getOrm(ref).then((orm) => {
		let filter: Filter = builder(orm);
		return executeFind(orm, {
			count: true,
			filter: filter,
			auth: auth
		}, trx);
	});
}

export function findAllWithCount<O extends Orm>(
	ref: string | symbol | O,
	builder: (orm: O) => FindAllQuery,
	auth?: any,
	trx?: Knex.Transaction
): Promise<FindAllWithCountResult> {
	return getOrm(ref).then((orm) => {
		let query: FindAllQuery = builder(orm);

		let rowsPromise: Promise<Object[]> = executeFind(orm, {
			fields: query.fields,
			filter: query.filter,
			sorts: normalizeSorts(query.sorts),
			pagination: query.pagination,
			auth: auth
		}, trx);

		let countPromise: Promise<number> = executeFind(orm, {
			count: true,
			filter: query.filter,
			auth: auth
		}, trx);

		return Promise.all([
			rowsPromise,
			countPromise
		]);
	}).then(([rows, count]) => {
		return {
			rows: rows,
			count: count
		};
	});
}

function normalizeSorts(sorts?: RawFindSortField[]): FindSortField[] | undefined {
	if (sorts == null || sorts.length === 0) {
		return;
	}
	return sorts.map((field) => {
		if (field instanceof Field) {
			return {
				field: field,
				direction: SortDirection.ASCENDING
			};
		}
		return {
			field: field.field,
			direction: field.direction ? normalizeSortDirection(field.direction) : SortDirection.ASCENDING
		};
	});
}
