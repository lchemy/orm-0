import * as core from "./core";
import * as builders from "./builders";
import * as definitions from "./definitions";
// import * as queries from "./queries";

export let define = definitions.define;
export module field {
	export type Boolean = core.BooleanField<core.Orm>;
	export type Enum<T> = core.EnumField<core.Orm, T>;
	export type Numerical = core.NumericalField<core.Orm>;
	export type Date = core.DateField<core.Orm>;
	export type String = core.StringField<core.Orm>;
	export type Binary = core.BinaryField<core.Orm>;

	export type JoinOne<O extends core.Orm> = O;
	export type JoinMany<J extends core.Orm> = core.JoinManyField<J, core.Orm>;
};

export module enums {
	export let SortDirection = core.SortDirection;
};

interface OrmLike extends core.Orm {
	[key: string]: core.Field<this, any> | core.JoinManyField<core.Orm, this> | core.Orm | OrmLike;
}
export {
	OrmLike as Orm
};

export function inspectOrm(orm: core.Orm): core.OrmProperties {
	return core.Orm.getProperties(orm);
}
export function inspectCompositeField(field: core.CompositeField): core.CompositeProperties {
	return core.CompositeField.getProperties(field);
}
