import * as Knex from "knex";

import { Field, Filter, Orm, SortDirection } from "../core";
import { FindQueryField, FindSortField, executeFind, getOrm, normalizeSortDirection } from "./helpers";

export type RawFindSortField = Field<any, any> | { field: Field<any, any>, direction?: string | number | SortDirection };

export interface FindOneQuery {
	fields?: FindQueryField[];
	filter?: Filter;
}

export interface FindAllQuery extends FindOneQuery {
	sorts?: RawFindSortField[];
	pagination?: { offset?: number, limit?: number };
}

export interface FindAllWithCountResult<M> {
	rows: M[];
	count: number;
}

export function findOne<O extends Orm>(ref: string | symbol | O, builder?: (orm: O) => FindOneQuery, auth?: any, trx?: Knex.Transaction): Promise<Object | undefined>;
export function findOne<O extends Orm, M>(ref: string | symbol | O, builder?: (orm: O) => FindOneQuery, auth?: any, trx?: Knex.Transaction): Promise<M | undefined>;
export function findOne<O extends Orm, M, A>(ref: string | symbol | O, builder?: (orm: O) => FindOneQuery, auth?: A, trx?: Knex.Transaction): Promise<M | undefined>;
export function findOne<O extends Orm, M, A>(ref: string | symbol | O, builder?: (orm: O) => FindOneQuery, auth?: A, trx?: Knex.Transaction): Promise<M | undefined> {
	return getOrm(ref).then((orm) => {
		let query: FindOneQuery = builder != null ? builder(orm) : {};

		return executeFind(orm, {
			fields: query.fields,
			filter: query.filter,
			auth: auth
		}, trx);
	}).then((rows: Object[]) => {
		return rows[0];
	});
}

export function findAll<O extends Orm>(ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: any, trx?: Knex.Transaction): Promise<Object[]>;
export function findAll<O extends Orm, M>(ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: any, trx?: Knex.Transaction): Promise<M[]>;
export function findAll<O extends Orm, M, A>(ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: A, trx?: Knex.Transaction): Promise<M[]>;
export function findAll<O extends Orm, M, A>(ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: A, trx?: Knex.Transaction): Promise<M[]> {
	return getOrm(ref).then((orm) => {
		let query: FindAllQuery = builder != null ? builder(orm) : {};

		return executeFind(orm, {
			fields: query.fields,
			filter: query.filter,
			sorts: normalizeSorts(query.sorts),
			pagination: query.pagination,
			auth: auth
		}, trx);
	});
}

export function findCount<O extends Orm>(ref: string | symbol | O, builder?: (orm: O) => Filter, auth?: any, trx?: Knex.Transaction): Promise<number>;
export function findCount<O extends Orm, A>(ref: string | symbol | O, builder?: (orm: O) => Filter, auth?: A, trx?: Knex.Transaction): Promise<number>;
export function findCount<O extends Orm, A>(ref: string | symbol | O, builder?: (orm: O) => Filter, auth?: A, trx?: Knex.Transaction): Promise<number> {
	return getOrm(ref).then((orm) => {
		let filter: Filter | undefined = builder != null ? builder(orm) : undefined;
		return executeFind(orm, {
			count: true,
			filter: filter,
			auth: auth
		}, trx);
	});
}

export function findAllWithCount<O extends Orm>(
	ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: any, trx?: Knex.Transaction
): Promise<FindAllWithCountResult<Object>>;
export function findAllWithCount<O extends Orm, M>(
	ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: any, trx?: Knex.Transaction
): Promise<FindAllWithCountResult<M>>;
export function findAllWithCount<O extends Orm, M, A>(
	ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: A, trx?: Knex.Transaction
): Promise<FindAllWithCountResult<M>>;
export function findAllWithCount<O extends Orm, M, A>(
	ref: string | symbol | O, builder?: (orm: O) => FindAllQuery, auth?: A, trx?: Knex.Transaction
): Promise<FindAllWithCountResult<M>> {
	return getOrm(ref).then((orm) => {
		let query: FindAllQuery = builder != null ? builder(orm) : {};

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

export function findByIds<O extends Orm>(
	ref: string | symbol | O, ids: number[] | string[], builder?: (orm: O) => FindQueryField[], auth?: any, trx?: Knex.Transaction
): Promise<Object[]>;
export function findByIds<O extends Orm, M>(
	ref: string | symbol | O, ids: number[] | string[], builder?: (orm: O) => FindQueryField[], auth?: any, trx?: Knex.Transaction
): Promise<M[]>;
export function findByIds<O extends Orm, M, A>(
	ref: string | symbol | O, ids: number[] | string[], builder?: (orm: O) => FindQueryField[], auth?: A, trx?: Knex.Transaction
): Promise<M[]>;
export function findByIds<O extends Orm, M, A>(
	ref: string | symbol | O, ids: number[] | string[], builder?: (orm: O) => FindQueryField[], auth?: A, trx?: Knex.Transaction
): Promise<M[]> {
	return getOrm(ref).then((orm) => {
		return executeFind(orm, {
			fields: builder != null ? builder(orm) : undefined,
			filter: Orm.getProperties(orm).primaryKey!.in(...ids),
			pagination: {
				limit: null
			},
			auth: auth
		}, trx);
	});
}

export function findById<O extends Orm>(
	ref: string | symbol | O, id: number | string, builder?: (orm: O) => FindQueryField[], auth?: any, trx?: Knex.Transaction
): Promise<Object | undefined>;
export function findById<O extends Orm, M>(
	ref: string | symbol | O, id: number | string, builder?: (orm: O) => FindQueryField[], auth?: any, trx?: Knex.Transaction
): Promise<M | undefined>;
export function findById<O extends Orm, M, A>(
	ref: string | symbol | O, id: number | string, builder?: (orm: O) => FindQueryField[], auth?: A, trx?: Knex.Transaction
): Promise<M | undefined>;
export function findById<O extends Orm, M, A>(
	ref: string | symbol | O, id: number | string, builder?: (orm: O) => FindQueryField[], auth?: A, trx?: Knex.Transaction
): Promise<M | undefined> {
	return getOrm(ref).then((orm) => {
		return executeFind(orm, {
			fields: builder != null ? builder(orm) : undefined,
			filter: Orm.getProperties(orm).primaryKey!.eq(id),
			auth: auth
		}, trx);
	}).then((rows: Object[]) => {
		return rows[0];
	});
}

// TODO: move to helpers
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
			direction: field.direction != null ? normalizeSortDirection(field.direction) : SortDirection.ASCENDING
		};
	});
}
