import { CompositeField, CompositeProperties, Field, FieldExclusion, JoinManyField, Orm, OrmProperties } from "../core";
import { FieldDefinition, JoinDefinition, JoinManyDefinition, JoinOneDefinition, OrmSchema } from "../definitions";
import { buildField } from "./field";
import { buildJoinManyOrm, buildJoinOneOrm } from "./join";

export function scaffold<O extends Orm>(
	orm: O, schema: OrmSchema<O>, includeJoins: boolean = true, obj: O | CompositeField = orm
): Promise<O | CompositeField> {
	let promise: Promise<any> = Promise.resolve();

	let ormProperties: OrmProperties = Orm.getProperties(orm),
		properties: OrmProperties | CompositeProperties;
	if (obj instanceof Orm) {
		properties = Orm.getProperties(obj);
	} else if (obj instanceof CompositeField) {
		properties = CompositeField.getProperties(obj);
	} else {
		// never
		// TODO: error?
		throw new Error();
	}

	let path: string[] = properties.path,
		defaultFields: Set<Field<any, any>> = properties.defaultFields;

	// add fields to object
	Object.keys(schema).filter((key) =>
		schema[key] instanceof FieldDefinition
	).forEach((key) => {
		// TODO: do something with default fields
		let definition: FieldDefinition<any> = schema[key] as FieldDefinition<any>,
			field: Field<O, any> = buildField(orm, path.concat(key), definition);
		Object.defineProperty(obj, key, {
			enumerable: true,
			value: field
		});

		if (definition.primary) {
			if (ormProperties.primaryKey != null) {
				// TODO: error
				throw new Error();
			}
			ormProperties.primaryKey = field;
		}

		if (field.exclusivity !== FieldExclusion.EXCLUDE) {
			defaultFields.add(field);
		}
	});

	// add composite fields
	promise = Object.keys(schema).filter((key) =>
		!(schema[key] instanceof FieldDefinition) &&
		!(schema[key] instanceof JoinDefinition)
	).reduce((p, key) => {
		let compositeSchema: OrmSchema<O> = schema[key] as OrmSchema<O>;
		return p.then(() => {
			return buildCompositeField(orm, path.concat(key), compositeSchema);
		}).then((compositeField) => {
			Object.defineProperty(obj, key, {
				enumerable: true,
				value: compositeField
			});

			CompositeField.getProperties(compositeField).defaultFields.forEach((defaultField) => {
				defaultFields.add(defaultField);
			});
		});
	}, promise);

	if (!includeJoins) {
		return promise.then(() => obj);
	}

	// add join ones
	promise = Object.keys(schema).filter((key) =>
		schema[key] instanceof JoinOneDefinition
	).reduce((p, key) => {
		let definition: JoinOneDefinition<O, Orm> = schema[key] as JoinOneDefinition<O, Orm>;
		return p.then(() => {
			return buildJoinOneOrm(orm, path.concat(key), definition);
		}).then((joinOrm) => {
			Object.defineProperty(obj, key, {
				enumerable: true,
				value: joinOrm
			});

			if (definition.exclusivity !== FieldExclusion.EXCLUDE) {
				Orm.getProperties(joinOrm).defaultFields.forEach((defaultField) => {
					defaultFields.add(defaultField);
				});
			}
		});
	}, promise);

	// add join many
	promise = Object.keys(schema).filter((key) =>
		schema[key] instanceof JoinManyDefinition
	).reduce((p, key) => {
		let definition: JoinManyDefinition<O, Orm> = schema[key] as JoinManyDefinition<O, Orm>;
		return p.then(() => {
			return buildJoinManyOrm(orm, path.concat(key), definition);
		}).then((joinOrm) => {
			let field: JoinManyField<Orm, O> = new JoinManyField(joinOrm, orm);
			Object.defineProperty(obj, key, {
				enumerable: true,
				value: field
			});

			if (definition.exclusivity !== FieldExclusion.EXCLUDE) {
				Orm.getProperties(joinOrm).defaultFields.forEach((defaultField) => {
					defaultFields.add(defaultField);
				});
			}
		});
	}, promise);

	return promise.then(() => obj);
}

export function buildCompositeField<O extends Orm>(
	orm: O, path: string[], schema: OrmSchema<O>, includeJoins: boolean = true
): Promise<CompositeField> {
	let compositeField: CompositeField = new CompositeField(orm, path);
	return scaffold(orm, schema, includeJoins, compositeField);
}
