/* tslint:disable no-namespace */
import { config, knex } from "./config/knex";
import {
	BinaryField, BooleanField, CompositeField, CompositeProperties, DateField,
	EnumField, Field, JoinManyField, NumericalField, Orm, OrmProperties, StringField
} from "./core";
import { define } from "./definitions";

export namespace field {
	export type Boolean = BooleanField<Orm>;
	export type Enum<T> = EnumField<Orm, T>;
	export type Numerical = NumericalField<Orm>;
	export type Date = DateField<Orm>;
	export type String = StringField<Orm>;
	export type Binary = BinaryField<Orm>;

	export type JoinOne<O extends Orm> = O;
	export type JoinMany<J extends Orm> = JoinManyField<J, Orm>;
}

export namespace debug {
	export function inspectOrm(orm: Orm): OrmProperties {
		return Orm.getProperties(orm);
	}
	export function inspectCompositeField(field: CompositeField): CompositeProperties {
		return CompositeField.getProperties(field);
	}
}

interface OrmLike extends Orm {
	[key: string]: Field<this, any> | JoinManyField<Orm, this> | Orm | OrmLike;
}
export {
	OrmLike as Orm,
	define,
	config,
	knex
};
