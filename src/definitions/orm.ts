import { scaffold } from "../builders";
import { Filter, Orm } from "../core";
import { ORM_CLASSES_CACHE, ORM_INSTANCES_CACHE } from "../misc/cache";
import { FieldDefinition, FieldDefinitions, fieldDefinitions } from "./field";
import { JoinDefinition, JoinDefinitions, joinDefinitions } from "./join";

export interface OrmDefinition {
	table: string;
	name?: string;
	ref?: string | symbol;
}

export interface OrmSchema<O extends Orm> {
	[key: string]: FieldDefinition<any> | JoinDefinition<O, any> | OrmSchema<O>;
}
type OrmSchemaBuilder<O extends Orm> = (field: FieldDefinitions, join: JoinDefinitions<O>) => OrmSchema<O>;

export type OrmAuthBuilder<A, O extends Orm> = (auth: A, orm: O) => Filter | undefined;

export function define<O extends Orm, M extends Object>(definition: OrmDefinition | string, schemaBuilder: OrmSchemaBuilder<O>): Promise<O>;
export function define<O extends Orm, M extends Object, A>(definition: OrmDefinition | string, schemaBuilder: OrmSchemaBuilder<O>, authBuilder: OrmAuthBuilder<A, O>): Promise<O>;
export function define<O extends Orm, M extends Object, A>(definition: OrmDefinition | string, schemaBuilder: OrmSchemaBuilder<O>, authBuilder?: OrmAuthBuilder<A, O>): Promise<O> {
	let parsedDefinition: OrmDefinition = parseOrmDefinition(definition);

	let schema: OrmSchema<O> = schemaBuilder(fieldDefinitions, joinDefinitions);

	let AnonOrm: typeof Orm = class extends Orm {
		static bootstrap(orm: O, includeJoins: boolean = true): Promise<O> {
			return scaffold(orm, schema, includeJoins).then((bootstrappedOrm: O) => {
				if (authBuilder != null) {
					Orm.getProperties(bootstrappedOrm).auth = (auth: any) => {
						return authBuilder!(auth, bootstrappedOrm);
					};
				}
				return bootstrappedOrm;
			});
		};

		constructor(tableAs: string = "root", path: string[] = []) {
			super(parsedDefinition.table, tableAs, path);
		}
	} as typeof Orm;

	Object.defineProperty(AnonOrm, "name", {
		value: parsedDefinition.name
	});

	ORM_CLASSES_CACHE.set(parsedDefinition.ref!, AnonOrm);

	return AnonOrm.bootstrap(new (AnonOrm as any)()).then((orm) => {
		ORM_INSTANCES_CACHE.set(parsedDefinition.ref!, orm);
		return orm;
	});
}

function parseOrmDefinition(definition: OrmDefinition | string): OrmDefinition {
	if (typeof definition === "string") {
		definition = {
			table: definition
		};
	}
	if (definition.name == null) {
		definition.name = getOrmName(definition.table);
	}
	if (definition.ref == null) {
		definition.ref = definition.table;
	}
	return definition;
}

function getOrmName(tableName: string): string {
	return tableName.replace(/((?:^|_)[a-z])/g, (match) => (match.length === 2 ? match[1] : match).toUpperCase()) + "Orm";
}
