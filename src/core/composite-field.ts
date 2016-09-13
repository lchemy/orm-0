import { Orm, OrmProperties, ORM_PROPERTIES } from "./orm";
import { Field } from "./field";

export const COMPOSITE_FIELD_PROPERTIES: symbol = Symbol("composite-field-properties");

export interface CompositeProperties {
	path: string[];

	root: Orm;
	base: Orm;
	parent?: Orm;

	defaultFields: Set<Field<any, any>>;
}

export class CompositeField {
	static getProperties(field: CompositeField): CompositeProperties {
		return field[COMPOSITE_FIELD_PROPERTIES] as CompositeProperties;
	}

	constructor(parent: Orm, path: string[]) {
		let parentProperties: OrmProperties = Orm.getProperties(parent);
		let properties: CompositeProperties = {
			path: path,

			root: parentProperties.root,
			base: parentProperties.base,
			parent: parent,

			defaultFields: new Set<Field<any, any>>()
		};
		this[COMPOSITE_FIELD_PROPERTIES] = properties;
	}
}
