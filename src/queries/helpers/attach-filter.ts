import * as Knex from "knex";

import { knex } from "../../config/knex";
import { Field, Filter, FilterGroup, FilterGrouping, FilterOperator, JoinManyFilterNode, OpFilterNode, Orm, OrmProperties } from "../../core";

const SQL_OPERATOR_MAP: { [operator: number]: string } = {
	[FilterOperator.EQ]:			"? = ?",
	[FilterOperator.NEQ]:			"? != ?",
	[FilterOperator.GT]:			"? > ?",
	[FilterOperator.GTE]:			"? >= ?",
	[FilterOperator.LT]:			"? < ?",
	[FilterOperator.LTE]:			"? <= ?",
	[FilterOperator.LIKE]:			"? LIKE ?",
	[FilterOperator.NOT_LIKE]:		"? NOT LIKE ?",
	[FilterOperator.BETWEEN]:		"? BETWEEN ? AND ?",
	[FilterOperator.NOT_BETWEEN]:	"? NOT BETWEEN ? AND ?",
	[FilterOperator.IN]:			"? IN (??)",
	[FilterOperator.NOT_IN]:		"? NOT IN (??)",
	[FilterOperator.IS_NULL]:		"? IS NULL",
	[FilterOperator.IS_NOT_NULL]:	"? IS NOT NULL"
};

export enum AttachFilterMode {
	WHERE,
	ON
};

export function attachFilter(builder: Knex.QueryBuilder, filter: Filter, mode: AttachFilterMode): Knex.QueryBuilder {
	return attachFilterHelper(builder, filter, mode, undefined);
}

function attachFilterHelper(builder: Knex.QueryBuilder, filter: Filter, mode: AttachFilterMode, grouping?: FilterGrouping): Knex.QueryBuilder {
	let fnName: string = getBuilderFnName(mode, grouping);

	if (filter instanceof OpFilterNode) {
		return builder[fnName](translateOpFilterNode(filter)) as Knex.QueryBuilder;
	}

	if (filter instanceof FilterGroup) {
		return builder[fnName](function (this: Knex.QueryBuilder): void {
			filter.expressions.reduce((b: Knex.QueryBuilder | undefined, expr: Filter) => {
				return attachFilterHelper(b == null ? this : b, expr, mode, b == null ? undefined : filter.grouping);
			}, undefined);
		}) as Knex.QueryBuilder;
	}

	if (filter instanceof JoinManyFilterNode) {
		if (mode !== AttachFilterMode.WHERE) {
			// cannot join on subquery, right?, throw error
			throw new Error(`Invalid filter join mode, cannot join on subquery`);
		}

		switch (filter.operator) {
			case FilterOperator.EXISTS:
				fnName += "Exists";
				break;
			case FilterOperator.NOT_EXISTS:
				fnName += "NotExists";
				break;
			default:
				// unknown operator, throw error
				throw new Error(`Invalid operator for join many: ${ filter.operator }, ${ FilterOperator[filter.operator] }`);
		}

		// TODO: andWhereExists and andWhereNotExists do not exist in knex, report bug?
		if (fnName === "andWhereExists") {
			fnName = "whereExists";
		} else if (fnName === "andWhereNotExists") {
			fnName = "whereNotExists";
		}

		return builder[fnName](translateJoinManyFilterNode(filter)) as Knex.QueryBuilder;
	}

	// invalid filter, throw error
	throw new Error(`Invalid filter: ${ filter }`);
}

function getBuilderFnName(mode: AttachFilterMode, grouping?: FilterGrouping): string {
	switch (mode) {
		case AttachFilterMode.ON:
			switch (grouping) {
				case FilterGrouping.AND:
					return "andOn";
				case FilterGrouping.OR:
					return "orOn";
				default:
					return "on";
			}
		default:
			switch (grouping) {
				case FilterGrouping.AND:
					return "andWhere";
				case FilterGrouping.OR:
					return "orWhere";
				default:
					return "where";
			}
	}
}

function translateOpFilterNode(filter: OpFilterNode<any, any>): Knex.Raw {
	let sql: string | undefined = SQL_OPERATOR_MAP[filter.operator];
	if (sql == null) {
		// invalid filter operator, throw error
		throw new Error(`Invalid filter operator: ${ filter.operator }, ${ FilterOperator[filter.operator] }`);
	}

	if (filter.operator === FilterOperator.IN && filter.value.length === 0) {
		return knex.raw("1 = 0");
	}
	if (filter.operator === FilterOperator.NOT_IN && filter.value.length === 0) {
		return knex.raw("1 = 1");
	}

	let values: any[] = [filter.field].concat(filter.value);

	let i: number = 0,
		l: number = values.length,
		bindings: any[] = [];

	let mapField: (value: any) => string = (value: any): string => {
		if (value instanceof Field) {
			const [table, column]: string[] = value.aliasedColumn.split(".");
			return `${ knex.client.wrapIdentifier(table) }.${ column }`;
		}
		bindings.push(value);
		return "?";
	};

	sql = sql.replace(/\?{1,2}/g, (match) => {
		if (i >= l) {
			// too many question marks, not enough arguments provided
			throw new Error(`Internal library error: number of sql parameters does not match provided parameters`);
		}

		if (match === "??") {
			let varExpr: string[] = [];
			for (i; i < l; i++) {
				varExpr.push(mapField(values[i]));
			}
			return varExpr.join(", ");
		}
		return mapField(values[i++]);
	});

	return knex.raw(sql, bindings);
}

function translateJoinManyFilterNode(filter: JoinManyFilterNode<any, any>): (this: Knex.QueryBuilder) => void {
	let joinOrmProperties: OrmProperties = Orm.getProperties(filter.field.orm),
		joinTableAlias: string = `${ joinOrmProperties.table } AS ${ joinOrmProperties.tableAs }`;
	return function (this: Knex.QueryBuilder): void {
		let query: Knex.QueryBuilder = this.table(joinTableAlias).select("*");
		joinOrmProperties.join!.through.forEach((joinExpr) => {
			let throughOrmProperties: OrmProperties = Orm.getProperties(joinExpr.orm),
				throughTableAlias: string = `${ throughOrmProperties.table } AS ${ throughOrmProperties.tableAs }`;
			// tslint:disable-next-line:no-shadowed-variable
			query.leftJoin(throughTableAlias, function (this: Knex.QueryBuilder): void {
				attachFilterHelper(this, joinExpr.on, AttachFilterMode.ON);
			});
		});

		let joinFilter: Filter = filter.field.joinWhere;
		if (filter.value != null) {
			joinFilter = joinFilter.and(filter.value);
		}
		attachFilterHelper(this, joinFilter, AttachFilterMode.WHERE);
	};
}
