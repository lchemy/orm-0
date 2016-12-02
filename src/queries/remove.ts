import * as Knex from "knex";

import { BoundedOrmAuthBuilder, Field, Filter, Orm, OrmProperties } from "../core";
import { executeRemove, getOrm, withTransaction } from "./helpers";

export function remove<O extends Orm>(ref: string | symbol | O, builder: (orm: O) => Filter, auth?: any, trx?: Knex.Transaction): Promise<number>;
export function remove<O extends Orm, A>(ref: string | symbol | O, builder: (orm: O) => Filter, auth?: A, trx?: Knex.Transaction): Promise<number>;
export function remove<O extends Orm, A>(ref: string | symbol | O, builder: (orm: O) => Filter, auth?: A, trx?: Knex.Transaction): Promise<number> {
	return getOrm(ref).then((orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			authBuilder: BoundedOrmAuthBuilder | undefined = ormProperties.auth,
			filter: Filter = builder(orm);

		if (authBuilder != null && auth != null) {
			let authFilter: Filter | undefined = authBuilder(auth);
			if (authFilter != null) {
				filter = filter.and(authFilter);
			}
		}

		return withTransaction((tx) => {
			return executeRemove(orm, filter, tx);
		}, trx);
	});
}

export function removeModels<O extends Orm>(ref: string | symbol | O, models: Object[], auth?: any, trx?: Knex.Transaction): Promise<number>;
export function removeModels<O extends Orm, M>(ref: string | symbol | O, models: M[], auth?: any, trx?: Knex.Transaction): Promise<number>;
export function removeModels<O extends Orm, M, A>(ref: string | symbol | O, models: M[], auth?: A, trx?: Knex.Transaction): Promise<number>;
export function removeModels<O extends Orm, M, A>(ref: string | symbol | O, models: M[], auth?: A, trx?: Knex.Transaction): Promise<number> {
	return remove(ref, (orm) => {
		let ormProperties: OrmProperties = Orm.getProperties(orm),
			primaryKey: Field<O, number | string> = ormProperties.primaryKey!;

		let ids: Array<number | string> = models.map((model) => primaryKey.mapper(model));
		return primaryKey.in(...ids);
	}, auth, trx);
}

export function removeModel<O extends Orm>(ref: string | symbol | O, model: Object, auth?: any, trx?: Knex.Transaction): Promise<undefined>;
export function removeModel<O extends Orm, M>(ref: string | symbol | O, model: M, auth?: any, trx?: Knex.Transaction): Promise<undefined>;
export function removeModel<O extends Orm, M, A>(ref: string | symbol | O, model: M, auth?: A, trx?: Knex.Transaction): Promise<undefined>;
export function removeModel<O extends Orm, M, A>(ref: string | symbol | O, model: M, auth?: A, trx?: Knex.Transaction): Promise<undefined> {
	return removeModels(ref, [model], auth, trx).then((count) => {
		if (count === 0) {
			// TODO: error
			return Promise.reject<undefined>(undefined);
		}
		return undefined;
	});
}
