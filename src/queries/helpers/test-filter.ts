import { Field, Filter, FilterGroup, FilterGrouping, FilterOperator, JoinManyFilterNode, OpFilterNode, Orm } from "../../core";

export function testFilter(filter: Filter, joinOrm: Orm, base: Object, join: Object): boolean {
	if (filter instanceof FilterGroup) {
		return testFilterGroup(filter, joinOrm, base, join);
	} else if (filter instanceof OpFilterNode) {
		return testOpFilterNode(filter, joinOrm, base, join);
	} else if (filter instanceof JoinManyFilterNode) {
		return testJoinManyFilterNode(filter, joinOrm, base, join);
	} else {
		// invalid filter, probably an instance of the abstract class?
		throw new Error(`Invalid filter: ${ filter }`);
	}
}

export function testFilterGroup(filter: FilterGroup, joinOrm: Orm, base: Object, join: Object): boolean {
	let predicate: (innerFilter: Filter) => boolean = (innerFilter) => {
		return testFilter(innerFilter, joinOrm, base, join);
	};

	if (filter.grouping === FilterGrouping.OR) {
		return filter.expressions.some(predicate);
	} else {
		return filter.expressions.every(predicate);
	}
}

export function testOpFilterNode(filter: OpFilterNode<any, any>, joinOrm: Orm, base: Object, join: Object): boolean {
	let filterField: any = getFieldValue(filter.field, joinOrm, base, join);

	let filterValueMapper: (value: any) => any = (value) => {
		if (value instanceof Field) {
			return getFieldValue(value, joinOrm, base, join);
		}
		return value;
	};
	let filterValue: any = Array.isArray(filter.value) ? filter.value.map(filterValueMapper) : filterValueMapper(filter.value);

	switch (filter.operator) {
		case FilterOperator.EQ:
			// tslint:disable-next-line:triple-equals
			return filterField == filterValue;
		case FilterOperator.NEQ:
			// tslint:disable-next-line:triple-equals
			return filterField != filterValue;
		case FilterOperator.GT:
			return filterField > filterValue;
		case FilterOperator.GTE:
			return filterField >= filterValue;
		case FilterOperator.LT:
			return filterField < filterValue;
		case FilterOperator.LTE:
			return filterField <= filterValue;
		case FilterOperator.LIKE:
			return testLike(filterField, filterValue);
		case FilterOperator.NOT_LIKE:
			return !testLike(filterField, filterValue);
		case FilterOperator.BETWEEN:
			return filterValue[0] <= filterField && filterField <= filterValue[1];
		case FilterOperator.NOT_BETWEEN:
			return filterValue[0] > filterField || filterField > filterValue[1];
		case FilterOperator.IN:
			return !!~(filterValue as any[]).indexOf(filterField);
		case FilterOperator.NOT_IN:
			return !~(filterValue as any[]).indexOf(filterField);
		case FilterOperator.IS_NULL:
			return filterField == null;
		case FilterOperator.IS_NOT_NULL:
			return filterField != null;
		default:
			throw new Error(`Invalid filter type for operator testing: ${ filter.operator }, ${ FilterOperator[filter.operator] }`);
	}
}

export function testJoinManyFilterNode(filter: JoinManyFilterNode<any, any>, joinOrm: Orm, base: Object, join: Object): boolean {
	// tslint:disable-next-line
	filter; joinOrm; base; join;

	// TODO: implement this?
	throw new Error("Unimplemented");
}

function getFieldValue<T>(field: Field<any, T>, joinOrm: Orm, base: Object, join: Object): T {
	if (Orm.getProperties(field.orm).base === joinOrm) {
		return join[field.columnAs];
	} else {
		return base[field.columnAs];
	}
}

function testLike(value: any, like: string): boolean {
	like = like.replace(/(\W|_)/g, "\\$1").replace(/(\\?)\\([\%\_])/g, (_, escape, type) => {
		if (!!escape) {
			return type;
		}
		if (type === "_") {
			return ".";
		} else {
			return ".*";
		}
	});
	return new RegExp(`^${ like }$`).test(value);
}
