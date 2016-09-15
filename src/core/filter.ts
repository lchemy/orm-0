import { FilterGrouping, FilterOperator } from "./enums";
import { Field } from "./field";
import { JoinManyField } from "./join-many-field";
import { Orm } from "./orm";

export abstract class FilterNode {
	abstract operator: FilterOperator;

	abstract fields: Field<any, any>[];

	and(...expressions: Filter[]): AndFilterGroup {
		return new AndFilterGroup(expressions.concat(this));
	}
	or(...expressions: Filter[]): OrFilterGroup {
		return new OrFilterGroup(expressions.concat(this));
	}

	abstract clone(): FilterNode;
}

export abstract class OpFilterNode<T, U> extends FilterNode {
	field: Field<any, T>;
	value: U;

	fields: Field<any, any>[];

	constructor(field: Field<any, T>, value: U) {
		super();

		this.field = field;
		this.value = value;

		let fields: Field<any, any>[] = [field];
		if (Array.isArray(value)) {
			value.filter((item) => item instanceof Field).forEach((item) => {
				fields.push(item);
			});
		} else if (value instanceof Field) {
			fields.push(value);
		}
		this.fields = fields;
	}
}

export type SubqueryFilterValue<J extends Orm, F extends Orm> = (orm: J, fromOrm: F) => Filter;
export abstract class JoinManyFilterNode<J extends Orm, F extends Orm> extends FilterNode {
	field: JoinManyField<J, F>;
	value?: Filter;

	constructor(field: JoinManyField<J, F>, query?: SubqueryFilterValue<J, F>) {
		super();

		this.field = field;
		if (query != null) {
			this.value = query(field.orm, field.fromOrm);
		}
	}

	get fields(): Field<any, any>[] {
		if (this.value == null) {
			return [];
		}
		return this.value.fields;
	}
}

export abstract class FilterGroup {
	abstract grouping: FilterGrouping;
	expressions: Filter[];

	fields: Field<any, any>[];

	constructor(expressions: Filter[]) {
		this.expressions = expressions;

		let fields: Field<any, any>[] = [];
		expressions.forEach((expression) => {
			fields.push.apply(fields, expression.fields);
		});
		this.fields = fields;
	}

	abstract and(...expressions: Filter[]): AndFilterGroup;
	abstract or(...expressions: Filter[]): OrFilterGroup;

	abstract clone(): FilterGroup;
}

export type Filter = FilterNode | FilterGroup;

export class EqualFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.EQ;

	clone(): EqualFilterNode<T> {
		return new EqualFilterNode(this.field, this.value);
	}
}
export class NotEqualFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.NEQ;

	clone(): NotEqualFilterNode<T> {
		return new NotEqualFilterNode(this.field, this.value);
	}
}
export class GreaterThanFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.GT;

	clone(): GreaterThanFilterNode<T> {
		return new GreaterThanFilterNode(this.field, this.value);
	}
}
export class GreaterThanEqualFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.GTE;

	clone(): GreaterThanEqualFilterNode<T> {
		return new GreaterThanEqualFilterNode(this.field, this.value);
	}
}
export class LessThanFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.LT;

	clone(): LessThanFilterNode<T> {
		return new LessThanFilterNode(this.field, this.value);
	}
}
export class LessThanEqualFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.LTE;

	clone(): LessThanEqualFilterNode<T> {
		return new LessThanEqualFilterNode(this.field, this.value);
	}
}
export class LikeFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.LIKE;

	clone(): LikeFilterNode<T> {
		return new LikeFilterNode(this.field, this.value);
	}
}
export class NotLikeFilterNode<T> extends OpFilterNode<T, T | Field<any, T>> {
	operator: FilterOperator = FilterOperator.NOT_LIKE;

	clone(): NotLikeFilterNode<T> {
		return new NotLikeFilterNode(this.field, this.value);
	}
}
export class BetweenFilterNode<T> extends OpFilterNode<T, [T | Field<any, T>, T | Field<any, T>]> {
	operator: FilterOperator = FilterOperator.BETWEEN;

	clone(): BetweenFilterNode<T> {
		return new BetweenFilterNode(this.field, this.value);
	}
}
export class NotBetweenFilterNode<T> extends OpFilterNode<T, [T | Field<any, T>, T | Field<any, T>]> {
	operator: FilterOperator = FilterOperator.NOT_BETWEEN;

	clone(): NotBetweenFilterNode<T> {
		return new NotBetweenFilterNode(this.field, this.value);
	}
}
export class InFilterNode<T> extends OpFilterNode<T, (T | Field<any, T>)[]> {
	operator: FilterOperator = FilterOperator.IN;

	clone(): InFilterNode<T> {
		return new InFilterNode(this.field, this.value);
	}
}
export class NotInFilterNode<T> extends OpFilterNode<T, (T | Field<any, T>)[]> {
	operator: FilterOperator = FilterOperator.NOT_IN;

	clone(): NotInFilterNode<T> {
		return new NotInFilterNode(this.field, this.value);
	}
}
export class IsNullFilterNode<T> extends OpFilterNode<T, undefined> {
	operator: FilterOperator = FilterOperator.IS_NULL;

	constructor(field: Field<any, T>) {
		super(field, undefined);
	}

	clone(): IsNullFilterNode<T> {
		return new IsNullFilterNode(this.field);
	}
}
export class IsNotNullFilterNode<T> extends OpFilterNode<T, undefined> {
	operator: FilterOperator = FilterOperator.IS_NOT_NULL;

	constructor(field: Field<any, T>) {
		super(field, undefined);
	}

	clone(): IsNotNullFilterNode<T> {
		return new IsNotNullFilterNode(this.field);
	}
}
export class ExistsFilterNode<J extends Orm, F extends Orm> extends JoinManyFilterNode<J, F> {
	operator: FilterOperator = FilterOperator.EXISTS;

	clone(): ExistsFilterNode<J, F> {
		let filter: ExistsFilterNode<J, F> = new ExistsFilterNode(this.field);
		filter.value = this.value;
		return filter;
	}
}
export class NotExistsFilterNode<J extends Orm, F extends Orm> extends JoinManyFilterNode<J, F> {
	operator: FilterOperator = FilterOperator.NOT_EXISTS;

	clone(): NotExistsFilterNode<J, F> {
		let filter: NotExistsFilterNode<J, F> = new NotExistsFilterNode(this.field);
		filter.value = this.value;
		return filter;
	}
}

export class AndFilterGroup extends FilterGroup {
	grouping: FilterGrouping = FilterGrouping.AND;

	and(...expressions: Filter[]): AndFilterGroup {
		this.expressions.push(...expressions);
		expressions.forEach((expression) => {
			this.fields.push.apply(this.fields, expression.fields);
		});
		return this;
	}
	or(...expressions: Filter[]): OrFilterGroup {
		return new OrFilterGroup(expressions.concat([this]));
	}

	clone(): AndFilterGroup {
		return new AndFilterGroup(this.expressions);
	}
}

export class OrFilterGroup extends FilterGroup {
	grouping: FilterGrouping = FilterGrouping.OR;

	and(...expressions: Filter[]): AndFilterGroup {
		return new AndFilterGroup(expressions.concat([this]));
	}
	or(...expressions: Filter[]): OrFilterGroup {
		this.expressions.push(...expressions);
		expressions.forEach((expression) => {
			this.fields.push.apply(this.fields, expression.fields);
		});
		return this;
	}

	clone(): OrFilterGroup {
		return new OrFilterGroup(this.expressions);
	}
}
