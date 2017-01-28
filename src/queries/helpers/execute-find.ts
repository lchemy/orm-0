import * as Knex from "knex";

import { knex } from "../../config/knex";
import { CompositeField, CompositeProperties, Field, Filter, JoinManyField, Orm, OrmJoinOn, OrmProperties, SortDirection } from "../../core";
import { AttachFilterMode, attachFilter } from "./attach-filter";
import { hydrateFilter } from "./hydrate-filter";
import { JoinResultContainer, mergeResultSets } from "./merge-result-sets";
import { unflatten } from "./unflatten";

export type FindQueryField = Field<any, any> | CompositeField | JoinManyField<any, any> | Orm;
export type FindSortField = Field<any, any> | { field: Field<any, any>, direction?: SortDirection };

export interface FindPagination {
	offset?: number;
	limit?: number | null;
}

export interface FindQuery {
	count?: boolean;
	fields?: FindQueryField[];
	filter?: Filter;
	sorts?: FindSortField[];
	pagination?: FindPagination;
	auth?: any;
}

// internal helper types
type OrmField = Field<Orm, any>;
type OrmFields = Set<OrmField>;
interface QueryData {
	fieldsMap: Map<Orm, OrmFields>;
	filterMap: Map<Orm, Filter>;
	relatedOrms: Orm[];
}
interface ExecutionTreeNode {
	children: ExecutionTreeNode[];
	orm: Orm;
	joinOrms: Orm[];
	fields: OrmFields;
	filter?: Filter;
}

export function executeFind(orm: Orm, query: FindQuery = {}, trx?: Knex.Transaction): Promise<number | Object[]> {
	if (Orm.getProperties(orm).root !== orm) {
		throw new Error(`Cannot execute find query for non-root orm: ${ Orm.getProperties(orm).tableAs }`);
	}

	let node: ExecutionTreeNode = buildExecutionTree(orm, query);
	return executeNode(node, query, trx).then((result) => {
		if (typeof result === "number") {
			return result;
		}
		return unflatten(result);
	});
}

function buildExecutionTree(orm: Orm, query: FindQuery): ExecutionTreeNode {
	let data: QueryData = getQueryData(orm, query);

	if (query.count) {
		return createTreeNode(orm, data);
	}

	let baseOrms: Orm[] = Array.from(new Set<Orm>(data.relatedOrms.map(getBase))),
		baseOrmsNodeMap: Map<Orm, ExecutionTreeNode> = new Map<Orm, ExecutionTreeNode>();

	baseOrms.forEach((baseOrm) => {
		baseOrmsNodeMap.set(baseOrm, createTreeNode(baseOrm, data));
	});
	baseOrms.forEach((baseOrm) => {
		let node: ExecutionTreeNode = baseOrmsNodeMap.get(baseOrm)!,
			parentOrm: Orm | undefined = Orm.getProperties(baseOrm).parent,
			parentBaseOrm: Orm | undefined = parentOrm != null ? getBase(parentOrm) : undefined;
		if (parentBaseOrm) {
			baseOrmsNodeMap.get(parentBaseOrm)!.children.push(node);
		}
	});

	return baseOrmsNodeMap.get(orm)!;
}

function createTreeNode(baseOrm: Orm, data: QueryData): ExecutionTreeNode {
	return  {
		orm: baseOrm,
		children: [],
		joinOrms: getJoinOrms(baseOrm, data.relatedOrms),
		fields: data.fieldsMap.get(baseOrm) || new Set<OrmField>(),
		filter: data.filterMap.get(baseOrm)
	};
}

function getQueryData(orm: Orm, query: FindQuery): QueryData {
	let data: QueryData = {
		fieldsMap: new Map<Orm, OrmFields>(),
		filterMap: new Map<Orm, Filter>(),
		relatedOrms: []
	};

	data = addRelatedOrm(orm, query, data);

	if (query.filter != null) {
		data = addFilter(orm, query.filter, query, data);
	}

	// only include query fields if count is true
	if (!query.count) {
		let queryFields: FindQueryField[] | undefined = query.fields;
		if (queryFields == null || queryFields.length === 0) {
			queryFields = Array.from(getDefaultFields(orm));
		}
		queryFields.forEach((field) => {
			if (field instanceof Field) {
				data = addField(field, query, data);
			} else {
				getDefaultFields(field).forEach((f) => {
					data = addField(f, query, data);
				});
			}
		});
	}

	return data;
}

function addRelatedOrm(relatedOrm: Orm, query: FindQuery, data: QueryData): QueryData {
	let relatedOrmProperties: OrmProperties = Orm.getProperties(relatedOrm);
	if (data.relatedOrms.indexOf(relatedOrm) >= 0) {
		return data;
	}

	// add parent as related orm before adding current
	if (relatedOrmProperties.parent != null) {
		data = addRelatedOrm(relatedOrmProperties.parent, query, data);
	}
	data.relatedOrms.push(relatedOrm);

	// if auth is available, add auth filter
	if (relatedOrmProperties.auth != null && query.auth != null) {
		let authFilter: Filter | undefined = relatedOrmProperties.auth(query.auth);
		if (authFilter != null) {
			data = addFilter(relatedOrm, authFilter, query, data);
		}
	}

	// if not count and join many, add required fields
	if (!query.count && relatedOrmProperties.join != null && relatedOrmProperties.join.many != null) {
		relatedOrmProperties.join.many.requiredBaseFields.forEach((f) => {
			data = addField(f, query, data);
		});
		relatedOrmProperties.join.many.requiredJoinFields.forEach((f) => {
			data = addField(f, query, data);
		});
	}

	return data;
}

function addField(field: OrmField, query: FindQuery, data: QueryData): QueryData {
	let baseOrm: Orm = getBase(field.orm),
		fields: OrmFields | undefined = data.fieldsMap.get(baseOrm);
	if (fields == null) {
		fields = new Set<OrmField>();
		data.fieldsMap.set(baseOrm, fields);
	}

	if (fields.has(field)) {
		return data;
	}
	fields.add(field);

	// add field's orm as related orm
	data = addRelatedOrm(field.orm, query, data);

	return data;
}

function addFilter(orm: Orm, newFilter: Filter, query: FindQuery, data: QueryData): QueryData {
	let baseOrm: Orm = getBase(orm),
		filter: Filter | undefined = data.filterMap.get(baseOrm);

	// set or append new filter to current filter
	filter = filter != null ? filter.and(newFilter) : newFilter;
	data.filterMap.set(baseOrm, filter);

	// add new filter fields' orms as related orms
	newFilter.fields.forEach((f) => {
		data = addRelatedOrm(f.orm, query, data);
	});

	return data;
}

function executeNode(node: ExecutionTreeNode, query: FindQuery, trx?: Knex.Transaction): Promise<number | Object[]> {
	// initialize builder
	let { table, tableAs }: OrmProperties = Orm.getProperties(node.orm);

	let builder: Knex.QueryBuilder;
	if (table === tableAs) {
		builder = knex.table(table);
	} else {
		builder = knex.table(`${ table } AS ${ tableAs }`);
	}

	// attach transaction if available
	if (trx != null) {
		builder.transacting(trx);
	}

	// JOIN
	node.joinOrms.forEach((joinOrm) => attachJoin(builder, node.orm, joinOrm));

	// WHERE
	if (node.filter != null) {
		attachFilter(builder, node.filter, AttachFilterMode.WHERE);
	}

	if (query.count) {
		// SELECT
		builder.count("* as $count");

		// execute the query
		return builder.then((res) => {
			return (res != null && res.length > 0 ? res[0].$count : 0) || 0;
		}) as any as Promise<number>;
	} else {
		// SELECT
		attachFields(builder, node.fields);

		// ORDER BY
		if (query.sorts != null) {
			attachSorts(builder, query.sorts);
		}

		// OFFSET, LIMIT
		attachPagination(builder, query.pagination);

		// execute the query
		return builder.then((baseResults) => {
			if (baseResults.length === 0 || node.children.length === 0) {
				return baseResults;
			}
			return executeNodeChildren(node, baseResults, trx);
		}) as any as Promise<Object[]>;
	}
}

function executeNodeChildren(node: ExecutionTreeNode, baseResults: Object[], trx?: Knex.Transaction): Promise<Object[]> {
	let promises: Array<Promise<JoinResultContainer>> = node.children.map((joinNode) => {
		if (node.orm === joinNode.orm || getBase(node.orm) === getBase(joinNode.orm)) {
			// TODO: this should never happen, throw error? is it even needed?
			throw new Error(`Something wrong!`);
		}

		// get join filter
		let joinFilter: Filter = Orm.getProperties(joinNode.orm).join!.on,
			hydratedJoinFilter: Filter = hydrateFilter(joinFilter, node.orm, baseResults);

		joinNode.filter = joinNode.filter != null ? hydratedJoinFilter.and(joinNode.filter) : hydratedJoinFilter;

		// execute join many
		return executeNode(joinNode, {
			count: false,
			pagination: {
				limit: null
			}
		}, trx).then((joinResults: Object[]) => {
			return {
				results: joinResults,
				orm: joinNode.orm,
				where: joinFilter
			};
		});
	});

	return Promise.all(promises).then((containers) => {
		return mergeResultSets(baseResults, containers);
	});
}

function attachFields(builder: Knex.QueryBuilder, fields: OrmFields): void {
	let namedColumns: string[] = Array.from(fields).map((field) => {
		return `${field.aliasedColumn} AS ${field.columnAs}`;
	});
	if (namedColumns.length === 0) {
		namedColumns.push(`1 AS __`);
	}
	builder.select(namedColumns);
}

function attachJoin(builder: Knex.QueryBuilder, orm: Orm, joinOrm: Orm): void {
	let joinOrmProperties: OrmProperties = Orm.getProperties(joinOrm),
		joins: OrmJoinOn[] = joinOrmProperties.join!.through;

	if (joinOrm !== orm) {
		joins = joins.concat([{
			orm: joinOrm,
			on: joinOrmProperties.join!.on
		}]);
	}

	// TODO: do slice().reverse() better?
	joins.forEach((join) => {
		let innerJoinOrmProperties: OrmProperties = Orm.getProperties(join.orm),
			innerJoinTableAlias: string = `${ innerJoinOrmProperties.table } AS ${ innerJoinOrmProperties.tableAs }`;
		builder.leftJoin(innerJoinTableAlias, function (this: Knex.QueryBuilder): void {
			attachFilter(this, join.on, AttachFilterMode.ON);
		});
	});
}

function attachSorts(builder: Knex.QueryBuilder, sorts: FindSortField[]): void {
	sorts.forEach((sort) => {
		if (sort instanceof Field) {
			builder.orderBy(sort.aliasedColumn, "ASC");
		} else {
			builder.orderBy(sort.field.aliasedColumn, sort.direction === SortDirection.DESCENDING ? "DESC" : "ASC");
		}
	});
}

function attachPagination(builder: Knex.QueryBuilder, pagination?: FindPagination): void {
	// TODO: extract default limit somewhere
	let offset: number = 0,
		limit: number | null = 50;

	if (pagination != null) {
		if (pagination.offset != null) {
			offset = Math.max(0, pagination.offset);
		}

		if (pagination.limit == null) {
			limit = null;
		} else if (pagination.limit !== undefined) {
			limit = Math.max(0, pagination.limit);
		}
	}

	builder.offset(offset);
	if (limit != null) {
		builder.limit(limit);
	}
}

function getJoinOrms(orm: Orm, relatedOrms: Orm[]): Orm[] {
	return relatedOrms.filter((relatedOrm) => {
		let relatedOrmProperties: OrmProperties = Orm.getProperties(relatedOrm);
		return relatedOrmProperties.base === orm && relatedOrmProperties.join != null;
	});
}

function getDefaultFields(field: JoinManyField<Orm, Orm> | CompositeField | Orm): OrmFields {
	let properties: OrmProperties | CompositeProperties;
	if (field instanceof JoinManyField) {
		properties = Orm.getProperties(field.orm);
	} else if (field instanceof Orm) {
		properties = Orm.getProperties(field);
	} else {
		properties = CompositeField.getProperties(field);
	}
	return properties.defaultFields;
}

function getBase(orm: Orm): Orm {
	return Orm.getProperties(orm).base;
}
