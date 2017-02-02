import {
	AndFilterGroup, EqualFilterNode, Field, Filter, FilterGroup, FilterGrouping, FilterOperator,
	GreaterThanEqualFilterNode, GreaterThanFilterNode, InFilterNode, JoinManyFilterNode, LessThanEqualFilterNode,
	LessThanFilterNode, LikeFilterNode, NotEqualFilterNode, NotInFilterNode, NotLikeFilterNode, OpFilterNode,
	OrFilterGroup, Orm, isFilter
} from "../../core";

export enum HydrationResult {
	PASS,
	FAIL
}

export function hydrateFilter(filter: Filter, orm: Orm, results: Object[]): Filter | HydrationResult {
	let needsHydration: boolean = filter.fields.some((field) => {
		return Orm.getProperties(field.orm).base === orm;
	});
	if (!needsHydration) {
		return filter;
	}

	if (filter instanceof FilterGroup) {
		return hydrateFilterGroup(filter, orm, results);
	} else if (filter instanceof OpFilterNode) {
		return hydrateOpFilterNode(filter, orm, results);
	} else if (filter instanceof JoinManyFilterNode) {
		return hydrateJoinManyFilterNode(filter, orm, results);
	} else {
		// invalid filter, probably an instance of the abstract class?
		throw new Error(`Invalid filter: ${ filter }`);
	}
}

export function hydrateFilterGroup(filter: FilterGroup, orm: Orm, results: Object[]): Filter | HydrationResult {
	let hydratedExpressions: Array<Filter | HydrationResult> = filter.expressions.map((expression) => {
		return hydrateFilter(expression, orm, results);
	});

	// check if we can simplify to a hydration result
	if (filter.grouping === FilterGrouping.OR) {
		let alwaysPass: boolean = hydratedExpressions.some((expression) => expression === HydrationResult.PASS);
		if (alwaysPass) {
			return HydrationResult.PASS;
		}
	} else {
		let alwaysFail: boolean = hydratedExpressions.some((expression) => expression === HydrationResult.FAIL);
		if (alwaysFail) {
			return HydrationResult.FAIL;
		}
	}

	// otherwise, strip out the hydration results; unnecessary
	let hydratedFilters: Filter[] = hydratedExpressions.filter(isFilter) as Filter[];
	if (filter.grouping === FilterGrouping.OR) {
		return new OrFilterGroup(hydratedFilters);
	} else {
		return new AndFilterGroup(hydratedFilters);
	}
}

export function hydrateOpFilterNode(filter: OpFilterNode<any, any>, orm: Orm, results: Object[]): Filter | HydrationResult {
	// TODO: find a better way to do the filter.field
	let filterField: Field<any, any> | any[] = hydrateField(filter.field, orm, results);

	let filterValueMapper: (value: any) => any = (value) => {
		if (value instanceof Field) {
			return hydrateField(value, orm, results);
		}
		return value;
	};
	let filterValue: Field<any, any> | any[] = Array.isArray(filter.value) ? filter.value.map(filterValueMapper) : filterValueMapper(filter.value);

	// TODO: dedupe values?
	// TODO: implement HydrationResult for more operators
	switch (filter.operator) {
		case FilterOperator.EQ:
			if (filterField instanceof Field) {
				return new InFilterNode(filterField, filterValue as any);
			}
			if (filterValue instanceof Field) {
				return new InFilterNode(filterValue, filterField as any);
			}
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new EqualFilterNode(right, left);
				}
				return new EqualFilterNode(left, right);
			}));
		case FilterOperator.NEQ:
			if (filterField instanceof Field) {
				return new NotInFilterNode(filterField, filterValue as any);
			}
			if (filterValue instanceof Field) {
				return new NotInFilterNode(filterValue, filterField as any);
			}
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new NotEqualFilterNode(right, left);
				}
				return new NotEqualFilterNode(left, right);
			}));
		case FilterOperator.GT:
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new LessThanEqualFilterNode(right, left);
				}
				return new GreaterThanFilterNode(left, right);
			}));
		case FilterOperator.GTE:
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new LessThanFilterNode(right, left);
				}
				return new GreaterThanEqualFilterNode(left, right);
			}));
		case FilterOperator.LT:
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new GreaterThanEqualFilterNode(right, left);
				}
				return new LessThanFilterNode(left, right);
			}));
		case FilterOperator.LTE:
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new GreaterThanFilterNode(right, left);
				}
				return new LessThanEqualFilterNode(left, right);
			}));
		case FilterOperator.LIKE:
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new LikeFilterNode(right, left);
				}
				return new LikeFilterNode(left, right);
			}));
		case FilterOperator.NOT_LIKE:
			return new OrFilterGroup(hydrateCrossFilterOp(filterField, filterValue, (left: any, right: any) => {
				if (right instanceof Field) {
					return new NotLikeFilterNode(right, left);
				}
				return new NotLikeFilterNode(left, right);
			}));
		case FilterOperator.BETWEEN:
			// TODO: implement
			throw new Error("Unimplemented");
		case FilterOperator.NOT_BETWEEN:
			// TODO: implement
			throw new Error("Unimplemented");
		case FilterOperator.IN:
			// TODO: implement
			throw new Error("Unimplemented");
		case FilterOperator.NOT_IN:
			// TODO: implement
			throw new Error("Unimplemented");
		case FilterOperator.IS_NULL:
			let hasNull: boolean = (filterField as any[]).some((value) => value == null);
			return hasNull ? HydrationResult.PASS : HydrationResult.FAIL;
		case FilterOperator.IS_NOT_NULL:
			let hasNotNull: boolean = (filterField as any[]).some((value) => value != null);
			return hasNotNull ? HydrationResult.PASS : HydrationResult.FAIL;
		default:
			// TODO: error
			throw new Error(`Invalid filter type for operator hydration: ${ filter.operator }, ${ FilterOperator[filter.operator] }`);
	}
}

export function hydrateJoinManyFilterNode(filter: JoinManyFilterNode<any, any>, orm: Orm, results: Object[]): Filter | HydrationResult {
	// tslint:disable-next-line
	filter; orm; results;

	// TODO: implement this?
	throw new Error("Unimplemented");
}

function hydrateField(field: Field<any, any>, orm: Orm, results: Object[]): Field<any, any> | any[] {
	if (Orm.getProperties(field.orm).base === orm) {
		return results.map((item) => {
			return item[field.columnAs];
		});
	}
	return field;
}

function hydrateCrossFilterOp(lefts: Field<any, any> | any[], rights: Field<any, any> | any[], cross: (left: any, right: any) => Filter): Filter[] {
	if (!Array.isArray(lefts)) {
		lefts = [lefts];
	}
	if (!Array.isArray(rights)) {
		rights = [rights];
	}

	let filters: Filter[] = [],
		leftSet: Set<any> = new Set(lefts),
		rightSet: Set<any> = new Set(rights);

	leftSet.forEach((left) => {
		rightSet.forEach((right) => {
			filters.push(cross(left, right));
		});
	});

	return filters;
}
