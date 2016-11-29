import { CompositeField, Field, Filter, JoinManyField, Orm, OrmJoinOn, OrmProperties } from "../core";
import { JoinFieldsBuilder, JoinManyDefinition, JoinOneDefinition, JoinThroughBuilder } from "../definitions";
import { ORM_CLASSES_CACHE } from "../misc/cache";

function buildJoinOrm<O extends Orm>(
	ref: string | symbol, path: string[], parentOrm: Orm,
	includeJoins: boolean = false, many: boolean = false, baseOrm?: Orm
): Promise<O> {
	return ORM_CLASSES_CACHE.getAwait(ref).then((AnonOrm) => {
		includeJoins = includeJoins && (function check(ancestorOrm: Orm | undefined, depth: number): boolean {
			if (ancestorOrm == null) {
				return true;
			}
			if (ancestorOrm instanceof AnonOrm) {
				depth += 1;
				if (depth > 3) {
					// avoid more than 5 self-joins
					return false;
				}
			}
			return check(Orm.getProperties(ancestorOrm).parent, depth);
		})(parentOrm, 0);

		let tableAs: string = path.join("$");
		let orm: O = new (AnonOrm as any)(tableAs, path) as O,
			properties: OrmProperties = Orm.getProperties(orm),
			parentProperties: OrmProperties = Orm.getProperties(parentOrm);

		properties.depth = parentProperties.depth + 1;
		properties.parent = parentOrm;

		if (many) {
			properties.base = baseOrm != null ? baseOrm : orm;
		} else {
			properties.base = parentProperties.base != null ? parentProperties.base : parentOrm;
		}
		properties.root = parentProperties.root != null ? parentProperties.root : parentOrm;

		return AnonOrm.bootstrap(orm, includeJoins);
	});
}

export function buildJoinOneOrm<O extends Orm, J extends Orm>(parentOrm: O, path: string[], definition: JoinOneDefinition<O, J>): Promise<J> {
	return buildJoinOrm<J>(definition.ref, path, parentOrm, definition.includeJoins, false).then((orm) => {
		let throughOrms: Orm[] = [],
			throughFilters: Filter[] = [];

		return definition.throughBuilders.reduce((p, throughBuilder, i) => {
			return p.then(() => {
				return buildJoinOneThroughOrm(parentOrm, orm, path.concat([`__through_${ i }`]), throughBuilder);
			}).then((throughOrm) => {
				throughOrms.push(throughOrm);
				throughFilters.push(throughBuilder.builder(parentOrm, ...throughOrms));
			});
		}, Promise.resolve()).then(() => {
			let onFilter: Filter = definition.onBuilder(parentOrm, ...throughOrms, orm);

			let properties: OrmProperties = Orm.getProperties(orm);
			properties.join = {
				on: onFilter,
				through: zipOrmJoinThrough(throughOrms, throughFilters)
			};

			if (definition.authBuilder != null) {
				properties.auth = (auth: any): Filter | undefined => {
					return definition.authBuilder!(auth, parentOrm, ...throughOrms, orm);
				};
			}

			if (definition.fieldsBuilder != null) {
				properties.defaultFields = expandFieldsBuilder<J>(orm, definition.fieldsBuilder);
			}

			return orm;
		});
	});
}

export function buildJoinManyOrm<O extends Orm, J extends Orm>(parentOrm: O, path: string[], definition: JoinManyDefinition<O, J>): Promise<J> {
	return buildJoinOrm<J>(definition.ref, path, parentOrm, definition.includeJoins, true).then((orm) => {
		let throughOrms: Orm[] = [],
			throughFilters: Filter[] = [];

		return definition.throughBuilders.reduce((p, throughBuilder, i) => {
			return p.then(() => {
				return buildJoinManyThroughOrm(parentOrm, orm, path.concat([`__through_${ i }`]), throughBuilder);
			}).then((throughOrm) => {
				throughOrms.push(throughOrm);
				throughFilters.push(throughBuilder.builder(orm, ...throughOrms));
			});
		}, Promise.resolve()).then(() => {
			let onFilter: Filter = definition.onBuilder(orm, ...throughOrms, parentOrm);

			let requiredBaseFields: Set<Field<any, any>> = new Set(),
				requiredJoinFields: Set<Field<any, any>> = new Set();

			let parentBaseOrm: Orm = Orm.getProperties(parentOrm).base;
			onFilter.fields.forEach((field) => {
				let baseOrm: Orm = Orm.getProperties(field.orm).base;
				if (baseOrm === parentBaseOrm) {
					requiredBaseFields.add(field);
				} else if (baseOrm === orm) {
					requiredJoinFields.add(field);
				}
			});

			let properties: OrmProperties = Orm.getProperties(orm);
			properties.join = {
				on: onFilter,
				through: zipOrmJoinThrough(throughOrms, throughFilters),
				many: {
					requiredBaseFields: requiredBaseFields,
					requiredJoinFields: requiredJoinFields
				}
			};

			if (definition.authBuilder != null) {
				properties.auth = (auth: any): Filter | undefined => {
					return definition.authBuilder!(auth, orm, ...throughOrms, parentOrm);
				};
			}

			if (definition.fieldsBuilder != null) {
				properties.defaultFields = expandFieldsBuilder<J>(orm, definition.fieldsBuilder);
			}

			return orm;
		});
	});
}

export function buildJoinOneThroughOrm<O extends Orm, J extends Orm, T extends Orm>(
	parentOrm: O, joinOrm: J, path: string[], throughBuilder: JoinThroughBuilder<O>
): Promise<T> {
	return buildJoinOrm<T>(throughBuilder.ref, path, parentOrm, false, false, joinOrm).then((orm) => {
		let properties: OrmProperties = Orm.getProperties(orm);
		properties.anonymous = true;
		return orm;
	});
}

export function buildJoinManyThroughOrm<O extends Orm, J extends Orm, T extends Orm>(
	parentOrm: O, joinOrm: J, path: string[], throughBuilder: JoinThroughBuilder<J>
): Promise<T> {
	return buildJoinOrm<T>(throughBuilder.ref, path, parentOrm, false, true, joinOrm).then((orm) => {
		let properties: OrmProperties = Orm.getProperties(orm);
		properties.anonymous = true;
		return orm;
	});
}

export function zipOrmJoinThrough(orms: Orm[], filters: Filter[]): OrmJoinOn[] {
	if (orms.length !== filters.length) {
		// TODO: error
		throw new Error();
	}
	return orms.map((orm, i) => {
		return {
			orm: orm,
			on: filters[i]
		};
	});
}

// TODO: add builder/definition checks
function expandFieldsBuilder<O extends Orm>(orm: O, fieldBuilder: JoinFieldsBuilder<O>): Set<Field<any, any>> {
	let defaultFields: Set<Field<any, any>> = new Set();

	fieldBuilder(orm).forEach((field) => {
		if (field == null) {
			// this can occur when two orms join each other and one explicitly refers to the other in fields builder
			return;
		}

		if (field instanceof Field) {
			defaultFields.add(field);
			return;
		}

		let addDefaultFields: Set<Field<any, any>>;
		if (field instanceof Orm) {
			addDefaultFields = Orm.getProperties(field).defaultFields;
		} else if (field instanceof JoinManyField) {
			addDefaultFields = Orm.getProperties(field.orm).defaultFields;
		} else if (field instanceof CompositeField) {
			addDefaultFields = CompositeField.getProperties(field).defaultFields;
		} else {
			throw new Error();
		}

		addDefaultFields.forEach((defaultField) => {
			defaultFields.add(defaultField);
		});
	});

	return defaultFields;
}
