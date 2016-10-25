import { Field } from "./field";
import { Filter } from "./filter";

export const ORM_PROPERTIES: symbol = Symbol("orm-properties");

export type BoundedOrmAuthBuilder = (auth: any) => Filter | undefined;

export interface OrmProperties {
	depth: number;

	table: string;
	tableAs: string;

	path: string[];

	root: Orm;
	base: Orm;
	parent?: Orm;

	anonymous: boolean;

	defaultFields: Set<Field<Orm, any>>;

	auth?: BoundedOrmAuthBuilder;

	join?: OrmJoinProperties;
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
	static bootstrap<O extends Orm>(orm: O, includeJoins: boolean = true): Promise<O> {
		let bootstrap: (orm: O, includeJoins?: boolean) => Promise<O> = (orm.constructor as any).bootstrap;
		if (bootstrap == null || bootstrap === Orm.bootstrap) {
			// TODO: error
			throw new Error();
		}
		return bootstrap(orm, includeJoins);
	}

	static getProperties(orm: Orm): OrmProperties {
		return orm[ORM_PROPERTIES] as OrmProperties;
	}

	constructor(table: string, tableAs: string = "root", path: string[] = []) {
		let properties: OrmProperties = {
			depth: 0,

			table: table,
			tableAs: tableAs,

			path: path,

			root: this,
			base: this,

			anonymous: false,

			defaultFields: new Set<Field<any, any>>()
		};
		this[ORM_PROPERTIES] = properties;
	}
}
