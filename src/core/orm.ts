import { Field } from "./field";
import { Filter } from "./filter";

export const ORM_PROPERTIES: symbol = Symbol("orm-properties");

export type BoundedOrmAuthBuilder = (auth: any) => Filter | undefined;

export interface OrmProperties {
	depth: number;

	table: string;
	tableAs: string;

	path: string[];

	primaryKey?: Field<Orm, number | string>;

	root: Orm;
	base: Orm;
	parent?: Orm;

	anonymous: boolean;

	fields: Set<Field<Orm, any>>;
	defaultFields: Set<Field<Orm, any>>;

	auth?: BoundedOrmAuthBuilder;

	join?: OrmJoinProperties;
	joinOrm?: Orm;
}

export interface OrmJoinProperties {
	on: Filter;
	through: OrmJoinOn[];
	many?: {
		requiredBaseFields: Set<Field<Orm, any>>;
		requiredJoinFields: Set<Field<Orm, any>>;
	};
}

export interface OrmJoinOn {
	orm: Orm;
	on: Filter;
}

export abstract class Orm {
	static getProperties(orm: Orm): OrmProperties {
		return orm[ORM_PROPERTIES] as OrmProperties;
	}

	constructor(table: string, tableAs: string = table, path: string[] = [], parentOrm?: Orm, baseOrm?: Orm, rootOrm?: Orm) {
		let properties: OrmProperties = {
			depth: 0,

			table: table,
			tableAs: tableAs,

			path: path,

			root: rootOrm || this,
			base: baseOrm || this,
			parent: parentOrm,

			anonymous: false,

			fields: new Set<Field<any, any>>(),
			defaultFields: new Set<Field<any, any>>()
		};
		this[ORM_PROPERTIES] = properties;
	}
}
