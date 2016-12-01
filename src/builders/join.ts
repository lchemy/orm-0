import { CompositeField, Field, Filter, JoinManyField, Orm, OrmJoinOn, OrmProperties } from "../core";
import { JoinFieldsBuilder, JoinManyDefinition, JoinOneDefinition, JoinThroughBuilder } from "../definitions";
import { ORM_CLASSES_CACHE } from "../misc/cache";

function buildJoinOrm<O extends Orm>(ref: string | symbol, path: string[], parentOrm: Orm, many: boolean, baseOrm?: Orm): O {
	let ormCtor: typeof Orm = ORM_CLASSES_CACHE.getSync(ref);

	let parentProperties: OrmProperties = Orm.getProperties(parentOrm);

	if (many) {
		baseOrm = baseOrm != null ? baseOrm : undefined;
	} else {
		baseOrm = parentProperties.base != null ? parentProperties.base : parentOrm;
	}
	let rootOrm: Orm = parentProperties.root != null ? parentProperties.root : parentOrm;

	let tableAs: string = path.join("$"),
		orm: O = new (ormCtor as any)(tableAs, path, parentOrm, baseOrm, rootOrm) as O,
		properties: OrmProperties = Orm.getProperties(orm);

	properties.depth = parentProperties.depth + 1;
	properties.parent = parentOrm;

	return orm;
}

export function buildJoinOneOrm<O extends Orm, J extends Orm>(parentOrm: O, path: string[], definition: JoinOneDefinition<O, J>): J {
	let orm: J = buildJoinOrm<J>(definition.ref, path, parentOrm, false),
		properties: OrmProperties = Orm.getProperties(orm);

	let throughOrms: Orm[] = [],
		throughFilters: Filter[] = [];

	definition.throughBuilders.forEach((throughBuilder, i) => {
		let throughOrm: Orm = buildJoinOneThroughOrm(parentOrm, orm, path.concat([`__through_${ i }`]), throughBuilder);
		throughOrms.push(throughOrm);
		throughFilters.push(throughBuilder.builder(parentOrm, ...throughOrms));
	});

	let onFilter: Filter = definition.onBuilder(parentOrm, ...throughOrms, orm);
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
}

export function buildJoinManyOrm<O extends Orm, J extends Orm>(parentOrm: O, path: string[], definition: JoinManyDefinition<O, J>): J {
	let orm: J = buildJoinOrm<J>(definition.ref, path, parentOrm, true),
		properties: OrmProperties = Orm.getProperties(orm);

	let throughOrms: Orm[] = [],
		throughFilters: Filter[] = [];

	definition.throughBuilders.forEach((throughBuilder, i) => {
		let throughOrm: Orm = buildJoinManyThroughOrm(parentOrm, orm, path.concat([`__through_${ i }`]), throughBuilder);
		throughOrms.push(throughOrm);
		throughFilters.push(throughBuilder.builder(orm, ...throughOrms));
	});

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
}

export function buildJoinOneThroughOrm<O extends Orm, J extends Orm, T extends Orm>(
	parentOrm: O, joinOrm: J, path: string[], throughBuilder: JoinThroughBuilder<O>
): T {
	let orm: T = buildJoinOrm<T>(throughBuilder.ref, path, parentOrm, false, joinOrm),
		properties: OrmProperties = Orm.getProperties(orm);
	properties.anonymous = true;
	properties.joinOrm = joinOrm;
	return orm;
}

export function buildJoinManyThroughOrm<O extends Orm, J extends Orm, T extends Orm>(
	parentOrm: O, joinOrm: J, path: string[], throughBuilder: JoinThroughBuilder<J>
): T {
	let orm: T = buildJoinOrm<T>(throughBuilder.ref, path, parentOrm, true, joinOrm),
		properties: OrmProperties = Orm.getProperties(orm);
	properties.anonymous = true;
	properties.joinOrm = joinOrm;
	return orm;
}

export function zipOrmJoinThrough(orms: Orm[], filters: Filter[]): OrmJoinOn[] {
	if (orms.length !== filters.length) {
		throw new Error(`Internal library error: number of join through orms does not match number of filters`);
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
		} else {
			addDefaultFields = CompositeField.getProperties(field).defaultFields;
		}

		addDefaultFields.forEach((defaultField) => {
			defaultFields.add(defaultField);
		});
	});

	return defaultFields;
}
