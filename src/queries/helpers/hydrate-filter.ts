import {
	Filter, Orm, Field,
	FilterOperator, FilterGroup, FilterGrouping, OpFilterNode, JoinManyFilterNode,

	EqualFilterNode, NotEqualFilterNode, GreaterThanFilterNode, GreaterThanEqualFilterNode, LessThanFilterNode,
	LessThanEqualFilterNode, LikeFilterNode, NotLikeFilterNode, BetweenFilterNode, NotBetweenFilterNode, InFilterNode,
	NotInFilterNode, IsNullFilterNode, IsNotNullFilterNode, AndFilterGroup, OrFilterGroup
} from "../../core";

export function hydrateFilter(filter: Filter, orm: Orm, results: Object[]): Filter {
	let needsHydration: boolean = filter.fields.some((field) => {
		return Orm.getProperties(field.orm).base !== orm;
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
		// TODO: error
		throw new Error();
	}
}

export function hydrateFilterGroup(filter: FilterGroup, orm: Orm, results: Object[]): Filter {
	let hydratedExpressions: Filter[] = filter.expressions.map((expression) => {
		return hydrateFilter(expression, orm, results);
	});
	if (filter.grouping === FilterGrouping.OR) {
		return new OrFilterGroup(hydratedExpressions);
	} else {
		return new AndFilterGroup(hydratedExpressions);
	}
}

export function hydrateOpFilterNode(filter: OpFilterNode<any, any>, orm: Orm, results: Object[]): Filter {
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
			// TODO: implement
			throw new Error("Unimplemented");
		case FilterOperator.IS_NOT_NULL:
			// TODO: implement
			throw new Error("Unimplemented");
		default:
			// TODO: error
			throw new Error();
	}
}

export function hydrateJoinManyFilterNode(filter: JoinManyFilterNode<any, any>, orm: Orm, results: Object[]): Filter {
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
