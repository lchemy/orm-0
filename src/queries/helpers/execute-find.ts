import * as Knex from "knex";

import { knex } from "../../config/knex";
import { CompositeField, Field, Filter, JoinManyField, Orm, OrmJoinOn, OrmProperties, SortDirection } from "../../core";
import { AttachFilterMode, attachFilter } from "./attach-filter";
import { hydrateFilter } from "./hydrate-filter";
import { JoinResultContainer, mergeResultSets } from "./merge-result-sets";
import { unflatten } from "./unflatten";

export type FindQueryField = Field<any, any> | CompositeField | JoinManyField<any, any> | Orm;
export type FindSortField = Field<any, any> | { field: Field<any, any>, direction?: SortDirection };

export interface FindQuery {
	count?: boolean;
	fields?: FindQueryField[];
	filter?: Filter;
	sorts?: FindSortField[];
	pagination?: { offset?: number, limit?: number };
	auth?: any;
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
		let selectFields: Set<Field<any, any>>;
		if (query.fields == null || query.fields.length === 0) {
			// TODO: get default fields
			selectFields = getDefaultFields(orm);
		} else {
			selectFields = new Set();
			query.fields.forEach((field: FindQueryField) => {
				if (field instanceof Field) {
					selectFields.add(field);
				} else {
					getDefaultFields(field).forEach((defaultField) => {
						selectFields.add(defaultField);
					});
				}
			});
		}
		ormFieldsMap = getOrmFieldsMap(selectFields, orm, baseOrm);

		let fieldOrms: Set<Orm> = new Set<Orm>([orm]);
		selectFields.forEach((field: Field<any, any>) => {
			if (Orm.getProperties(field.orm).base === baseOrm) {
				fieldOrms.add(field.orm);
			}
		});

		fieldOrms.forEach((fieldOrm) => {
			let ormFields: Set<Field<any, any>> | undefined = ormFieldsMap.get(fieldOrm);
			if (ormFields == null) {
				return;
			}
			ormFields.forEach((field) => {
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
		if (namedColumns.length === 0) {
			namedColumns.push(`1 AS ${ ormProperties.tableAs }.__`);
		}
		builder.select(namedColumns);
	}

	// TODO: refactor this part
	let filter: Filter | undefined = query.filter;
	let relatedOrms: Set<Orm> = new Set();
	let addRelatedOrm: (relatedOrm: Orm) => boolean = (relatedOrm: Orm) => {
		let relatedOrmProperties: OrmProperties = Orm.getProperties(relatedOrm);
		if (relatedOrmProperties.base !== baseOrm) {
			return false;
		}
		if (relatedOrms.has(relatedOrm)) {
			return true;
		}

		relatedOrms.add(relatedOrm);
		if (relatedOrmProperties.join != null) {
			addJoinOrm(relatedOrm);
		}
		if (relatedOrmProperties.auth && query.auth) {
			addFilter(relatedOrmProperties.auth(query.auth));
		}
		if (relatedOrmProperties.parent != null) {
			addRelatedOrm(relatedOrmProperties.parent);
		}
		return true;
	};
	let addFilter: (newFilter?: Filter) => void = (newFilter?: Filter) => {
		if (newFilter == null) {
			return;
		}

		if (filter == null) {
			filter = newFilter;
		} else {
			filter = filter.and(newFilter);
		}
		filter.fields.filter((field) => {
			return addRelatedOrm(field.orm);
		}).forEach((field) => {
			fields.add(field);
		});
	};
	let addJoinOrm: (joinOrm: Orm) => void = (joinOrm: Orm) => {
		// TODO: this is really add join orms and through orms of current orm
		let joinOrmProperties: OrmProperties = Orm.getProperties(joinOrm),
			joins: OrmJoinOn[] = joinOrmProperties.join!.through;
		if (joinOrm !== orm) {
			joins = joins.concat([{
				orm: joinOrm,
				on: joinOrmProperties.join!.on
			}]);
		}
		joins.forEach((join) => {
			let innerJoinOrmProperties: OrmProperties = Orm.getProperties(join.orm),
				innerJoinTableAlias: string = `${ innerJoinOrmProperties.table } AS ${ innerJoinOrmProperties.tableAs }`;
			builder.leftJoin(innerJoinTableAlias, function (this: Knex.QueryBuilder): void {
				attachFilter(this, join.on, AttachFilterMode.ON);
			});
		});
	};

	addRelatedOrm(orm);
	fields.forEach((field) => {
		addRelatedOrm(field.orm);
	});
	addFilter(query.filter);

	// WHERE
	if (filter != null) {
		attachFilter(builder, filter, AttachFilterMode.WHERE);
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
	// TODO: allow limit to be explicitly null
	if (!query.count && ormProperties.root === orm) {
		let offset: number = 0,
			limit: number = 50;
		if (query.pagination != null) {
			if (query.pagination.offset != null) {
				offset = Math.max(0, query.pagination.offset);
			}
			if (query.pagination.limit != null) {
				limit = Math.max(0, query.pagination.limit);
			}
		}
		builder.offset(offset);
		builder.limit(limit);
	}

	if (!!query.count) {
		// TODO: bluebird is not happy?
		return builder.then((result) => {
			if (result == null || result.length === 0) {
				return 0;
			}
			return result[0].count || 0;
		}) as any as Promise<number>;
	}

	if (ormFieldsMap.size <= 1) {
		// TODO: bluebird is not happy?
		return builder.then((result) => {
			return result;
		}) as any as Promise<Object[]>;
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
				filter: hydrateFilter(joinWhere, orm, baseResults),
				auth: query.auth
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
	}) as any as Promise<Object[]>;
}

type OrmFieldsMap = Map<Orm, Set<Field<any, any>>>;
function getOrmFieldsMap(fields: Set<Field<any, any>>, orm: Orm, baseOrm: Orm): OrmFieldsMap {
	let ormFieldsMap: OrmFieldsMap = new Map();

	fields.forEach((field) => {
		addToOrmFieldsMap(field, orm, baseOrm, ormFieldsMap);
	});

	let ormProperties: OrmProperties = Orm.getProperties(orm);
	if (ormProperties.join != null && ormProperties.join.many != null) {
		ormProperties.join.many.requiredJoinFields.forEach((field) => {
			addToOrmFieldsMap(field, orm, baseOrm, ormFieldsMap);
		});
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
