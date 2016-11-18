/* tslint:disable no-namespace */
import {
	BinaryField, BooleanField, CompositeField, CompositeProperties, DateField,
	EnumField, Field, JoinManyField, NumericalField, Orm, OrmProperties, StringField
} from "./core";
import { ORM_INSTANCES_CACHE } from "./misc/cache";

export { config, knex } from "./config/knex";
export { define } from "./definitions";
export {
	FindAllQuery, FindAllWithCountResult, FindOneQuery, UpdateQuery,
	findAll, findAllWithCount, findById, findByIds, findCount, findOne, insert, insertOne, remove, removeModel, removeModels, update, updateModel, updateModels
} from "./queries";

export namespace field {
	export namespace primary {
		export type Numerical = NumericalField<Orm>;
		export type String = StringField<Orm>;
	}

	export type Boolean = BooleanField<Orm>;
	export type Enum<T> = EnumField<Orm, T>;
	export type Numerical = NumericalField<Orm>;
	export type Date = DateField<Orm>;
	export type String = StringField<Orm>;
	export type Binary = BinaryField<Orm>;
}

export namespace join {
	export type One<O extends Orm> = O;
	export type Many<J extends Orm> = JoinManyField<J, Orm>;
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
	OrmLike as Orm
};

export function awaitOrmsReady(): Promise<void> {
	return ORM_INSTANCES_CACHE.awaitAll();
}
