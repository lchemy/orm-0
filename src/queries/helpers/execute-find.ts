import * as Knex from "knex";
import { knex } from "../../config/knex";

import { Filter, Orm, OrmProperties, OrmJoinOn, Field, CompositeField, JoinManyField, SortDirection } from "../../core";
import { attachFilter, AttachFilterMode } from "./attach-filter";
import { mergeResultSets, JoinResultContainer } from "./merge-result-sets";
import { hydrateFilter } from "./hydrate-filter";
import { unflatten } from "./unflatten";

export type FindQueryField = Field<any, any> | CompositeField | JoinManyField<any, any> | Orm;

export interface FindQuery {
	count?: boolean;
	fields?: FindQueryField[];
	filter?: Filter;
	sorts?: (Field<any, any> | { field: Field<any, any>, direction?: SortDirection })[];
	pagination?: { offset?: number, limit?: number };
}

export function executeFind(orm: Orm, query: FindQuery = {}, trx?: Knex.Transaction): Promise<number | Object[]> {
	return executeFindInner(orm, orm, query, trx).then((result) => {
		if (typeof result === "number") {
			return result;
		}
		return unflatten(result);
	});
}

function executeFindInner(orm: Orm, baseOrm: Orm, query: FindQuery, trx?: Knex.Transaction): Promise<number | Object[]> {
	let ormProperties: OrmProperties = Orm.getProperties(orm);

	let builder: Knex.QueryBuilder = knex.table(`${ ormProperties.table } AS ${ ormProperties.tableAs }`);
	if (trx != null) {
		builder.transacting(trx);
	}

	let ormFieldsMap: OrmFieldsMap,
		fields: Set<Field<any, any>> = new Set();

	// SELECT
	if (!!query.count) {
		builder.count("* AS count");

		ormFieldsMap = new Map();
	} else {
		if (query.fields == null || query.fields.length === 0) {
			// TODO: get default fields
			query.fields = Array.from(getDefaultFields(orm));
		}
		ormFieldsMap = getOrmFieldsMap(query.fields!, orm, baseOrm);

		let fieldOrms: Set<Orm> = new Set<Orm>([orm]);
		query.fields!.forEach((field: Field<any, any>) => {
			if (Orm.getProperties(field.orm).base === baseOrm) {
				fieldOrms.add(field.orm);
			}
		});

		fieldOrms.forEach((fieldOrm) => {
			ormFieldsMap.get(fieldOrm).forEach((field) => {
				fields.add(field);
			});
		});

		if (ormProperties.join != null && ormProperties.join.many != null) {
			ormProperties.join.many.requiredJoinFields.forEach((field) => {
				fields.add(field);
			});
		}

		if (fields == null || fields.size === 0) {
			// probably selecting only from some unbounded join many
			// TODO: should this be an error instead?
		}
		let namedColumns: string[] = Array.from(fields).map((field) => {
			return `${field.aliasedColumn} AS ${field.columnAs}`;
		});
		builder.select(namedColumns);
	}

	// WHERE
	if (query.filter) {
		query.filter.fields.filter((field) => {
			return Orm.getProperties(field.orm).base === baseOrm;
		}).forEach((field) => {
			fields.add(field);
		});
		attachFilter(builder, query.filter, AttachFilterMode.WHERE);
	}

	// ORDER BY
	if (query.sorts) {
		query.sorts.forEach((sort) => {
			if (sort instanceof Field) {
				builder.orderBy(sort.aliasedColumn, "ASC");
			} else {
				builder.orderBy(sort.field.aliasedColumn, sort.direction === SortDirection.DESCENDING ? "DESC" : "ASC");
			}
		});
	}

	// LIMIT
	if (!query.count && ormProperties.root === orm) {
		let offset: number = 0,
			limit: number = 50;
		if (query.pagination != null) {
			if (query.pagination.offset != null) {
				offset = Math.max(0, query.pagination.offset);
			}
			if (query.pagination.limit != null) {
				limit = Math.max(0, Math.min(query.pagination.limit, 500));
			}
		}
		builder.offset(offset);
		builder.limit(limit);
	}

	// JOIN
	getJoinOrms(fields, orm, baseOrm).forEach((joinOrm) => {
		let joinOrmProperties: OrmProperties = Orm.getProperties(joinOrm);
		if (joinOrmProperties.join == null) {
			return;
		}

		let joins: OrmJoinOn[] = joinOrmProperties.join.through;
		if (joinOrm !== orm) {
			joins = joins.concat([{
				orm: joinOrm,
				on: joinOrmProperties.join.on
			}]);
		}
		joins.forEach((join) => {
			let innerJoinOrmProperties: OrmProperties = Orm.getProperties(join.orm),
				innerJoinTableAlias: string = `${ innerJoinOrmProperties.table } AS ${ innerJoinOrmProperties.tableAs }`;
			builder.leftJoin(innerJoinTableAlias, function (this: Knex.QueryBuilder): void {
				attachFilter(this, join.on, AttachFilterMode.ON);
			});
		});
	});

	if (!!query.count) {
		// TODO: bluebird is not happy?
		return builder.then((result) => {
			if (result == null || result.length === 0) {
				return 0;
			}
			return result[0].count || 0;
		}) as any;
	}

	if (ormFieldsMap.size <= 1) {
		// TODO: bluebird is not happy?
		return builder.then((result) => {
			return result;
		}) as any;
	}

	// TODO: handle distinct or something?
	return builder.then((baseResults) => {
		if (baseResults.length === 0) {
			return baseResults;
		}

		let promises: Promise<JoinResultContainer>[] = [];
		ormFieldsMap.forEach((joinFields: Set<Field<any, any>>, joinOrm: Orm) => {
			if (joinOrm === orm) {
				return;
			}

			let joinOrmProperties: OrmProperties = Orm.getProperties(joinOrm);
			if (joinOrmProperties.base === baseOrm) {
				return;
			}

			let joinWhere: Filter = joinOrmProperties.join!.on;

			let promise: Promise<JoinResultContainer> = executeFindInner(joinOrm, joinOrm, {
				fields: Array.from(joinFields),
				filter: hydrateFilter(joinWhere, orm, baseResults)
			}, trx).then((joinResults: Object[]) => {
				return {
					results: joinResults,
					orm: joinOrm,
					where: joinWhere
				};
			});

			promises.push(promise);
		});

		return Promise.all(promises).then((containers) => {
			return mergeResultSets(baseResults, containers);
		});
	}) as any;
}

type OrmFieldsMap = Map<Orm, Set<Field<any, any>>>;
function getOrmFieldsMap(fields: FindQueryField[], orm: Orm, baseOrm: Orm): OrmFieldsMap {
	let ormFieldsMap: OrmFieldsMap = new Map();

	fields.forEach((field) => {
		if (field instanceof Field) {
			addToOrmFieldsMap(field, orm, baseOrm, ormFieldsMap);
			return;
		}
		getDefaultFields(field).forEach((innerField) => {
			addToOrmFieldsMap(innerField, orm, baseOrm, ormFieldsMap);
		});
	});

	let ormProperties: OrmProperties = Orm.getProperties(orm);
	if (ormProperties.join != null && ormProperties.join.many != null) {
		ormProperties.join.many.requiredJoinFields.forEach((field) => {
			addToOrmFieldsMap(field, orm, baseOrm, ormFieldsMap);
		});
	}

	if (!ormFieldsMap.has(orm) || ormFieldsMap.get(orm).size === 0) {
		// TODO: not selecting anything
		throw new Error();
	}

	return ormFieldsMap;
}

function addToOrmFieldsMap(field: Field<any, any>, orm: Orm, baseOrm: Orm, ormFieldsMap: OrmFieldsMap): void {
	let fieldBaseOrm: Orm = Orm.getProperties(field.orm).base;
	if (fieldBaseOrm === baseOrm) {
		// base orm and field base orm is the same, not a many-to-many join
		upsertOrmFieldsMap(field, field.orm, ormFieldsMap);
		return;
	}

	let joinOrm: Orm = fieldBaseOrm,
		joinOrmProperties: OrmProperties = Orm.getProperties(joinOrm);

	// traverse up parent's bases until parent's base is base orm or no parents exist (how can this happen?)
	while (joinOrmProperties.parent != null && Orm.getProperties(joinOrmProperties.parent).base !== baseOrm) {
		joinOrm = Orm.getProperties(joinOrmProperties.parent).base;
		joinOrmProperties = Orm.getProperties(joinOrm);
	}

	let addNewJoin: boolean = upsertOrmFieldsMap(field, joinOrm, ormFieldsMap);
	if (addNewJoin && joinOrmProperties.join != null && joinOrmProperties.join.many != null) {
		joinOrmProperties.join.many.requiredBaseFields.forEach((innerField) => {
			addToOrmFieldsMap(field, orm, baseOrm, ormFieldsMap);
		});
	}
}

function upsertOrmFieldsMap(field: Field<any, any>, orm: Orm, ormFieldsMap: OrmFieldsMap): boolean {
	let set: Set<Field<any, any>> | undefined = ormFieldsMap.get(orm),
		insert: boolean = (set == null);
	if (insert) {
		set = new Set();
		ormFieldsMap.set(orm, set);
	}
	set.add(field);
	return insert;
}

function getJoinOrms(fields: Set<Field<any, any>>, orm: Orm, baseOrm: Orm): Set<Orm> {
	let joinOrms: Set<Orm> = new Set([orm]);
	fields.forEach((field) => {
		addJoinOrm(field.orm, baseOrm, joinOrms);
	});
	return joinOrms;
}

function addJoinOrm(joinOrm: Orm, baseOrm: Orm, joinOrms: Set<Orm>): void {
	if (joinOrms.has(joinOrm)) {
		return;
	}
	joinOrms.add(joinOrm);

	// join all parents unless base is no longer within current base
	let joinOrmProperties: OrmProperties = Orm.getProperties(joinOrm);
	if (joinOrmProperties.parent != null && Orm.getProperties(joinOrmProperties.parent).base === baseOrm) {
		addJoinOrm(joinOrmProperties.parent, baseOrm, joinOrms);
	}
}


function getDefaultFields(field: JoinManyField<any, any> | CompositeField | Orm): Set<Field<any, any>> {
	if (field instanceof JoinManyField) {
		return Orm.getProperties(field.orm).defaultFields;
	} else if (field instanceof Orm) {
		return Orm.getProperties(field).defaultFields;
	} else if (field instanceof CompositeField) {
		return CompositeField.getProperties(field).defaultFields;
	} else {
		// TODO: error
		throw new Error();
	}
}
