import * as Knex from "knex";

import { BoundedOrmAuthBuilder, Field, Filter, Orm, OrmProperties } from "../core";
import { UpdateData, executeUpdate, getOrm, withTransaction } from "./helpers";

export interface UpdateQuery<O extends Orm> {
	fields: Array<Field<O, any>>;
	filter: Filter;
}

interface UpdateModel {
	id: number | string;
	data: UpdateData;
}

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
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			query: UpdateQuery<O> = builder(orm),
			authFilter: Filter | undefined = authBuilder != null && auth != null ? authBuilder(auth) : undefined;

		// TODO: validations and etc.
		// TODO: make sure no nulls or undefined (unless we want to? that would mean default?)
		let data: UpdateData = query.fields.reduce((memo, field) => {
			memo[field.column] = field.mapper(model);
			return memo;
		}, {});

		let filter: Filter = query.filter;
		if (authFilter != null) {
			filter = filter.and(authFilter);
		}

		return withTransaction((tx) => {
			return executeUpdate(orm, data, filter, tx);
		}, trx);
	});
}

export function updateModels<O extends Orm>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, models: Object[], auth?: any, trx?: Knex.Transaction
): Promise<number[] | string[]>;
export function updateModels<O extends Orm, M>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, models: M[], auth?: any, trx?: Knex.Transaction
): Promise<number[] | string[]>;
export function updateModels<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, models: M[], auth?: A, trx?: Knex.Transaction
): Promise<number[] | string[]>;
export function updateModels<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, models: M[], auth?: A, trx?: Knex.Transaction
): Promise<number[] | string[]> {
	return getOrm(ref).then((orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			primaryKey: Field<O, number | string> = ormProperties.primaryKey!,
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			fields: Array<Field<O, any>> = builder(orm),
			authFilter: Filter | undefined = authBuilder != null && auth != null ? authBuilder(auth) : undefined;

		// TODO: validations and etc.
		let updateModels: UpdateModel[] = models.map((model) => {
			let id: number | string = primaryKey.mapper(model);
			let data: UpdateData = fields.reduce((memo, field) => {
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

					return executeUpdate(orm, model.data, filter, tx).then((res) => {
						return res + count;
					});
				});
			}, Promise.resolve(0)).then<number[] | string[]>((count) => {
				if (count === 0) {
					return Promise.reject(new Error(`Failed to update any models, expected to update ${ models.length } model(s)`));
				}

				return updateModels.map((m) => m.id) as (number[] | string[]);
			});
		}, trx);
	});
}

export function updateModel<O extends Orm>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, model: Object, auth?: any, trx?: Knex.Transaction
): Promise<number | string>;
export function updateModel<O extends Orm, M>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, model: M, auth?: any, trx?: Knex.Transaction
): Promise<number | string>;
export function updateModel<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, model: M, auth?: A, trx?: Knex.Transaction
): Promise<number | string>;
export function updateModel<O extends Orm, M, A>(
	ref: string | symbol | O, builder: (orm: O) => Array<Field<O, any>>, model: M, auth?: A, trx?: Knex.Transaction
): Promise<number | string> {
	return updateModels(ref, builder, [model], auth, trx).then((ids) => {
		return ids[0];
	});
}
