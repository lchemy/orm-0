import * as Knex from "knex";

import { BoundedOrmAuthBuilder, Field, Filter, Orm, OrmProperties } from "../core";
import { AttachFilterMode, attachFilter, getOrm, withTransaction } from "./helpers";

export interface UpdateQuery<O extends Orm> {
	fields: Field<O, any>[];
	filter: Filter;
}

interface UpdateModelData {
	[key: string]: any;
};

interface UpdateModel {
	id: number | string;
	data: UpdateModelData;
};

export function update<O extends Orm>(
	ref: string | symbol | O, builder: (orm: O) => UpdateQuery<O>, model: Object, auth?: any, trx?: Knex.Transaction
): Promise<number>;
export function update<O extends Orm, M>(
	ref: string | symbol | O, builder: (orm: O) => UpdateQuery<O>, model: M, auth?: any, trx?: Knex.Transaction
): Promise<number>;
export function update<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => UpdateQuery<O>, model: M, auth?: A, trx?: Knex.Transaction
): Promise<number>;
export function update<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => UpdateQuery<O>, model: M, auth?: A, trx?: Knex.Transaction
): Promise<number> {
	return getOrm(ref).then((orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			table: string = ormProperties.table,
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			query: UpdateQuery<O> = builder(orm),
			authFilter: Filter | undefined = authBuilder != null && auth != null ? authBuilder(auth) : undefined;

		// TODO: validations and etc.
		let data: UpdateModelData = query.fields.reduce((memo, field) => {
			memo[field.column] = field.mapper(model);
			return memo;
		}, {});

		let filter: Filter = query.filter;
		if (authFilter != null) {
			filter = filter.and(authFilter);
		}

		return withTransaction((tx) => {
			let updateQuery: Knex.QueryBuilder = tx.update(data).table(`${ table } AS root`);
			attachFilter(updateQuery, filter, AttachFilterMode.WHERE); // TODO: need to attach joins, if needed
			return updateQuery.then((res) => res) as any as Promise<number>;
		}, trx);
	});
}

export function updateModels<O extends Orm>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], models: Object[], auth?: any, trx?: Knex.Transaction
): Promise<number[] | string[]>;
export function updateModels<O extends Orm, M>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], models: M[], auth?: any, trx?: Knex.Transaction
): Promise<number[] | string[]>;
export function updateModels<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], models: M[], auth?: A, trx?: Knex.Transaction
): Promise<number[] | string[]>;
export function updateModels<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], models: M[], auth?: A, trx?: Knex.Transaction
): Promise<number[] | string[]> {
	return getOrm(ref).then((orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			primaryKey: Field<O, number | string> = ormProperties.primaryKey!,
			table: string = ormProperties.table,
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			fields: Field<O, any>[] = builder(orm),
			authFilter: Filter | undefined = authBuilder != null && auth != null ? authBuilder(auth) : undefined;

		// TODO: validations and etc.
		let updateModels: UpdateModel[] = models.map((model) => {
			let id: number | string = primaryKey.mapper(model);
			let data: UpdateModelData = fields.reduce((memo, field) => {
				memo[field.column] = field.mapper(model);
				return memo;
			}, {});

			return {
				id: id,
				data: data
			};
		}).filter((model) => {
			return model.id != null;
		});

		return withTransaction((tx) => {
			return updateModels.reduce((prev, model) => {
				return prev.then((count) => {
					let filter: Filter = primaryKey.eq(model.id);
					if (authFilter != null) {
						filter = filter.and(authFilter);
					}

					let updateQuery: Knex.QueryBuilder = tx.update(model.data).table(`${ table } AS root`);
					attachFilter(updateQuery, filter, AttachFilterMode.WHERE); // TODO: need to attach joins, if needed
					return updateQuery.then((res) => {
						return res + count;
					}) as any as Promise<number>;
				});
			}, Promise.resolve(0)).then<number[] | string[]>((count) => {
				if (count === 0) {
					// TODO: error
					return Promise.reject(undefined);
				}

				return updateModels.map((m) => m.id) as (number[] | string[]);
			});
		});
	});
}

export function updateModel<O extends Orm>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], model: Object, auth?: any, trx?: Knex.Transaction
): Promise<number | string>;
export function updateModel<O extends Orm, M>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], model: M, auth?: any, trx?: Knex.Transaction
): Promise<number | string>;
export function updateModel<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], model: M, auth?: A, trx?: Knex.Transaction
): Promise<number | string>;
export function updateModel<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Field<O, any>[], model: M, auth?: A, trx?: Knex.Transaction
): Promise<number | string> {
	return updateModels(ref, builder, [model], auth, trx).then((ids) => {
		return ids[0];
	});
}
