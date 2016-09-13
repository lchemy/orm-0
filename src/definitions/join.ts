import {
	Orm, Field, FieldExclusion, CompositeField, JoinManyField, Filter
} from "../core";

import { normalizeExclusivity } from "./field";

export type JoinFieldsBuilder<J extends Orm> = (orm: J) => (Field<J, any> | CompositeField | JoinManyField<any, J> | Orm)[];
export type JoinExpressionBuilder<O extends Orm> = (root: O, ...orms: Orm[]) => Filter;
export interface JoinThroughBuilder<O extends Orm> {
	ref: string | symbol;
	builder: JoinExpressionBuilder<O>;
}

export abstract class JoinDefinition<O extends Orm, J extends Orm> {
	ref: string | symbol;
	exclusivity: FieldExclusion;
	includeJoins: boolean;
	fieldsBuilder?: JoinFieldsBuilder<J>;
	abstract throughBuilders: JoinThroughBuilder<O | J>[];
	abstract onBuilder: JoinExpressionBuilder<O | J>;

	constructor(ref: string | symbol, exclusivity: FieldExclusion, includeJoins: boolean) {
		this.ref = ref;
		this.exclusivity = exclusivity;
		this.includeJoins = includeJoins;
	}

	fields(fieldsBuilder: JoinFieldsBuilder<J>): this {
		this.fieldsBuilder = fieldsBuilder;
		return this;
	}

	abstract through(ref: string | symbol, ...orms: Orm[]): this;
	abstract on(...orms: Orm[]): this;
}

export class JoinOneDefinition<O extends Orm, J extends Orm> extends JoinDefinition<O, J> {
	throughBuilders: JoinThroughBuilder<O>[] = [];
	onBuilder: JoinExpressionBuilder<O>;

	through(ref: string | symbol, builder: JoinExpressionBuilder<O>): this {
		this.throughBuilders.push({
			ref: ref,
			builder: builder
		});
		return this;
	}

	on(builder: JoinExpressionBuilder<O>): this {
		this.onBuilder = builder;
		return this;
	}
}

export class JoinManyDefinition<O extends Orm, J extends Orm> extends JoinDefinition<O, J> {
	throughBuilders: JoinThroughBuilder<J>[] = [];
	onBuilder: JoinExpressionBuilder<J>;

	through(ref: string | symbol, builder: JoinExpressionBuilder<J>): this {
		this.throughBuilders.push({
			ref: ref,
			builder: builder
		});
		return this;
	}

	on(builder: JoinExpressionBuilder<J>): this {
		this.onBuilder = builder;
		return this;
	}
}

export type JoinOneDefiner<O extends Orm> = <J extends Orm>(ref: string | symbol, exclusivity?: FieldExclusion | boolean, includeJoins?: boolean) => JoinOneDefinition<O, J>;
export type JoinManyDefiner<O extends Orm> = <J extends Orm>(ref: string | symbol, exclusivity?: FieldExclusion | boolean, includeJoins?: boolean) => JoinManyDefinition<O, J>;
export interface JoinDefinitions<O extends Orm> {
	one: JoinOneDefiner<O>;
	many: JoinManyDefiner<O>;
}
export const joinDefinitions: JoinDefinitions<Orm> = {
	one: (ref: string | symbol, exclusivity?: FieldExclusion | boolean, includeJoins: boolean = false) => {
		return new JoinOneDefinition<Orm, Orm>(ref, normalizeExclusivity(exclusivity, FieldExclusion.EXCLUDE), includeJoins);
	},
	many: (ref: string | symbol, exclusivity?: FieldExclusion | boolean, includeJoins: boolean = false) => {
		return new JoinManyDefinition<Orm, Orm>(ref, normalizeExclusivity(exclusivity, FieldExclusion.EXCLUDE), includeJoins);
	}
};
