import { buildOrm, buildOrmClass } from "../builders";
import { Filter, Orm } from "../core";
import { ORM_CLASSES_CACHE, ORM_DEFINITIONS_CACHE, ORM_INSTANCES_CACHE } from "../misc/cache";
import { FieldDefinition, FieldDefinitions, fieldDefinitions } from "./field";
import { JoinDefinition, JoinDefinitions, joinDefinitions } from "./join";

export type OrmSchemaBuilder<O extends Orm> = (field: FieldDefinitions, join: JoinDefinitions<O>) => OrmSchema<O>;
export type OrmAuthBuilder<A, O extends Orm> = (auth: A, orm: O) => Filter | undefined;

export type OrmRef = string | symbol;
export interface OrmSchema<O extends Orm> {
	[key: string]: FieldDefinition<any> | JoinDefinition<O, any> | OrmSchema<O>;
}
export interface OrmDefinition<O extends Orm> {
	table: string;
	name: string;
	ref: OrmRef;
	schema: OrmSchema<O>;
	authBuilder?: OrmAuthBuilder<any, O>;
}

export interface OrmTag {
	table: string;
	name?: string;
	ref?: OrmRef;
}

export function define<O extends Orm>(tag: string | OrmTag, schemaBuilder: OrmSchemaBuilder<O>): Promise<O>;
export function define<O extends Orm, A>(tag: string | OrmTag, schemaBuilder: OrmSchemaBuilder<O>, authBuilder: OrmAuthBuilder<A, O>): Promise<O>;
export function define<O extends Orm, A>(tag: string | OrmTag, schemaBuilder: OrmSchemaBuilder<O>, authBuilder?: OrmAuthBuilder<A, O>): Promise<O> {
	tag = normalizeOrmTag(tag);

	let schema: OrmSchema<O> = schemaBuilder(fieldDefinitions, joinDefinitions);

	let definition: OrmDefinition<O> = {
		table: tag.table,
		name: tag.name!,
		ref: tag.ref!,
		schema: schema,
		authBuilder: authBuilder
	};
	ORM_DEFINITIONS_CACHE.set(definition.ref, definition);

	return ORM_DEFINITIONS_CACHE.awaitAll().then(() => {
		let ormCtor: typeof Orm = buildOrmClass(definition.ref);
		ORM_CLASSES_CACHE.set(definition.ref, ormCtor);

		return ORM_CLASSES_CACHE.awaitAll();
	}).then(() => {
		let orm: O = buildOrm<O>(definition.ref);
		ORM_INSTANCES_CACHE.set(definition.ref, orm);

		return orm;
	});
}

function normalizeOrmTag(tag: string | OrmTag): OrmTag {
	let table: string,
		name: string | undefined,
		ref: OrmRef | undefined;

	if (typeof tag === "string") {
		table = tag;
	} else {
		table = tag.table;
		name = tag.name;
		ref = tag.ref;
	}

	if (name == null) {
		name = getOrmName(table);
	}

	if (ref == null) {
		ref = table;
	}

	return { table, name, ref };
}

function getOrmName(tableName: string): string {
	return tableName.replace(/((?:^|_)[a-z])/g, (match) => (match.length === 2 ? match[1] : match).toUpperCase()) + "Orm";
}
