import { CompositeField, CompositeProperties, Field, FieldExclusion, JoinManyField, Orm, OrmProperties } from "../core";
import { FieldDefinition, JoinDefinition, JoinManyDefinition, JoinOneDefinition, OrmDefinition, OrmRef, OrmSchema } from "../definitions";
import { ORM_CLASSES_CACHE, ORM_DEFINITIONS_CACHE } from "../misc/cache";
import { buildField } from "./field";
import { buildJoinManyOrm, buildJoinOneOrm } from "./join";

export function buildOrm<O extends Orm>(ref: OrmRef): O {
	let ormCtor: typeof Orm = ORM_CLASSES_CACHE.getSync(ref),
		orm: O = new (ormCtor as any)() as O;
	return orm;
}

export function buildOrmClass<O extends Orm>(ref: OrmRef): typeof Orm {
	let definition: OrmDefinition<O> = ORM_DEFINITIONS_CACHE.getSync(ref);

	let ormCtor: typeof Orm = class extends Orm {
		constructor(tableAs: string = "root", path: string[] = [], parentOrm?: Orm, baseOrm?: Orm, rootOrm?: Orm) {
			super(definition.table, tableAs, path, parentOrm, baseOrm, rootOrm);

			let self: O = this as any as O;
			scaffold<O>(self, definition.schema);
			if (definition.authBuilder != null) {
				Orm.getProperties(self).auth = (auth: any) => {
					return definition.authBuilder!(auth, self);
				};
			}
		}
	} as typeof Orm;

	Object.defineProperty(ormCtor, "name", {
		value: definition.name
	});

	return ormCtor;
}

function scaffold<O extends Orm>(orm: O, schema: OrmSchema<O>, obj: O | CompositeField = orm): O | CompositeField {
	let ormProperties: OrmProperties = Orm.getProperties(orm),
		properties: OrmProperties | CompositeProperties = obj instanceof Orm ? ormProperties : CompositeField.getProperties(obj);

	let path: string[] = properties.path,
		defaultFields: Set<Field<any, any>> = properties.defaultFields;

	// add fields to object
	Object.keys(schema).filter((key) => {
		return schema[key] instanceof FieldDefinition;
	}).forEach((key) => {
		let definition: FieldDefinition<any> = schema[key] as FieldDefinition<any>,
			field: Field<O, any> = buildField(orm, path.concat(key), definition);
		Object.defineProperty(obj, key, {
			enumerable: true,
			value: field
		});

		if (definition.primary) {
			if (ormProperties.primaryKey != null) {
				throw new Error(`Attempted to add two primary keys to ${ ormProperties.table }: ${ ormProperties.primaryKey.column } and ${ field.column }`);
			}
			ormProperties.primaryKey = field;
		}

		if (field.exclusivity !== FieldExclusion.EXCLUDE) {
			defaultFields.add(field);
		}
	});

	// add composite fields
	Object.keys(schema).filter((key) => {
		return !(schema[key] instanceof FieldDefinition || schema[key] instanceof JoinDefinition);
	}).forEach((key) => {
		let compositeSchema: OrmSchema<O> = schema[key] as OrmSchema<O>,
			compositeField: CompositeField = buildCompositeField(orm, path.concat(key), compositeSchema);
		Object.defineProperty(obj, key, {
			enumerable: true,
			value: compositeField
		});

		CompositeField.getProperties(compositeField).defaultFields.forEach((defaultField) => {
			defaultFields.add(defaultField);
		});
	});

	// add join ones
	Object.keys(schema).filter((key) =>
		schema[key] instanceof JoinOneDefinition
	).forEach((key) => {
		let definition: JoinOneDefinition<O, Orm> = schema[key] as JoinOneDefinition<O, Orm>;

		defineLazyProperty(obj, key, {
			enumerable: true
		}, getJoinOneEvaluator(orm, path.concat(key), definition));

		if (definition.exclusivity !== FieldExclusion.EXCLUDE && !isJoinedTo(orm, definition.ref)) {
			Orm.getProperties(obj[key] as Orm).defaultFields.forEach((defaultField) => {
				defaultFields.add(defaultField);
			});
		}
	});

	// add join many
	Object.keys(schema).filter((key) =>
		schema[key] instanceof JoinManyDefinition
	).forEach((key) => {
		let definition: JoinManyDefinition<O, Orm> = schema[key] as JoinManyDefinition<O, Orm>;

		defineLazyProperty(obj, key, {
			enumerable: true
		}, getJoinManyEvaulator(orm, path.concat(key), definition));

		if (definition.exclusivity !== FieldExclusion.EXCLUDE && !isJoinedTo(orm, definition.ref)) {
			Orm.getProperties((obj[key] as JoinManyField<Orm, O>).orm).defaultFields.forEach((defaultField) => {
				defaultFields.add(defaultField);
			});
		}
	});

	return obj;
}

export function buildCompositeField<O extends Orm>(orm: O, path: string[], schema: OrmSchema<O>): CompositeField {
	let compositeField: CompositeField = new CompositeField(orm, path);
	return scaffold(orm, schema, compositeField);
}

// TODO: move to misc?
function defineLazyProperty(obj: Object, key: string, descriptor: PropertyDescriptor, evaluation: (this: Object) => any): void {
	// iife to encapsulate local variables
	(() => {
		let cached: any | undefined,
			evaluated: boolean = false;
		descriptor.get = function (this: Object): any {
			if (!evaluated) {
				evaluated = true;
				cached = evaluation.call(this);
			}
			return cached;
		};
	})();

	Object.defineProperty(obj, key, descriptor);
}

function getJoinOneEvaluator<O extends Orm>(orm: O, path: string[], definition: JoinOneDefinition<O, Orm>): () => Orm {
	return () => {
		return buildJoinOneOrm(orm, path, definition);
	};
}

function getJoinManyEvaulator<O extends Orm>(orm: O, path: string[], definition: JoinManyDefinition<O, Orm>): () => JoinManyField<Orm, O> {
	return () => {
		let joinOrm: Orm = buildJoinManyOrm(orm, path, definition),
			field: JoinManyField<Orm, O> = new JoinManyField(joinOrm, orm);
		return field;
	};
}

function isJoinedTo(orm: Orm, targetRef: OrmRef): boolean {
	let targetOrmCtor: typeof Orm = ORM_CLASSES_CACHE.getSync(targetRef);
	return isJoinedToHelper(orm, targetOrmCtor);
}
function isJoinedToHelper(orm: Orm, targetOrmCtor: typeof Orm): boolean {
	if (orm instanceof targetOrmCtor) {
		return true;
	}

	let properties: OrmProperties = Orm.getProperties(orm);
	if (properties.parent == null) {
		return false;
	}

	return isJoinedToHelper(properties.parent, targetOrmCtor);
}
