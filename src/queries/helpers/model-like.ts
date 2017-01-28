import * as Knex from "knex";

export type ModelLike<M> = M | {
	[K in keyof M]: M[K] | Knex.Raw
};
