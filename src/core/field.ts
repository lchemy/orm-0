import { FieldExclusion, FieldType } from "./enums";
import {
	BetweenFilterNode, EqualFilterNode, GreaterThanEqualFilterNode, GreaterThanFilterNode, InFilterNode,
	IsNotNullFilterNode, IsNullFilterNode, LessThanEqualFilterNode, LessThanFilterNode, LikeFilterNode,
	NotBetweenFilterNode, NotEqualFilterNode, NotInFilterNode, NotLikeFilterNode
} from "./filter";
import { Orm } from "./orm";

export type FieldMapper<T> = (model: Object) => T;

export abstract class Field<O extends Orm, T> {
	abstract type: FieldType;

	orm: Orm;
	path: string[];
	column: string;

	exclusivity: FieldExclusion;
	mapper: FieldMapper<T>;

	constructor(orm: O, path: string[], column: string, exclusivity: FieldExclusion = FieldExclusion.INCLUDE, mapper?: FieldMapper<T>) {
		this.orm = orm;
		this.path = path;
		this.column = column;
		this.exclusivity = exclusivity;

		if (mapper != null) {
			this.mapper = mapper;
		} else {
			this.mapper = (model: Object) => {
				return this.path.reduce((memo, piece) => {
					return memo != null ? memo[piece] : memo;
				}, model) as T;
			};
		}
	}

	get tableAs(): string {
		return Orm.getProperties(this.orm).tableAs;
	}

	get columnAs(): string {
		return this.path.join(".");
	}

	get aliasedColumn(): string {
		return `${ this.tableAs }.${ this.column }`;
	}

	// TODO: use this with outputs
	get isAnonymous(): boolean {
		return Orm.getProperties(this.orm).anonymous;
	}

	eq(value: T | Field<any, T>): EqualFilterNode<T> {
		return new EqualFilterNode(this, value);
	}
	neq(value: T | Field<any, T>): NotEqualFilterNode<T> {
		return new NotEqualFilterNode(this, value);
	}

	in(...values: (T | Field<any, T>)[]): InFilterNode<T> {
		return new InFilterNode(this, values);
	}
	notIn(...values: (T | Field<any, T>)[]): NotInFilterNode<T> {
		return new NotInFilterNode(this, values);
	}

	isNull(): IsNullFilterNode<T> {
		return new IsNullFilterNode(this);
	}
	isNotNull(): IsNotNullFilterNode<T> {
		return new IsNotNullFilterNode(this);
	}
}

export abstract class ComparableField<O, T> extends Field<O, T> {
	gt(value: T | Field<any, T>): GreaterThanFilterNode<T> {
		return new GreaterThanFilterNode(this, value);
	}
	gte(value: T | Field<any, T>): GreaterThanEqualFilterNode<T> {
		return new GreaterThanEqualFilterNode(this, value);
	}
	lt(value: T | Field<any, T>): LessThanFilterNode<T> {
		return new LessThanFilterNode(this, value);
	}
	lte(value: T | Field<any, T>): LessThanEqualFilterNode<T> {
		return new LessThanEqualFilterNode(this, value);
	}
}

export abstract class RangeField<O, T> extends ComparableField<O, T> {
	between(min: T | Field<any, T>, max: T | Field<any, T>): BetweenFilterNode<T> {
		return new BetweenFilterNode(this, [min, max]);
	}
	notBetween(min: T | Field<any, T>, max: T | Field<any, T>): NotBetweenFilterNode<T> {
		return new NotBetweenFilterNode(this, [min, max]);
	}
}

export abstract class LikeField<O, T> extends ComparableField<O, T> {
	like(value: T | Field<any, T>): LikeFilterNode<T> {
		return new LikeFilterNode(this, value);
	}
	notLike(value: T | Field<any, T>): NotLikeFilterNode<T> {
		return new NotLikeFilterNode(this, value);
	}
}

export class BooleanField<O> extends Field<O, boolean> {
	type: FieldType = FieldType.BOOLEAN;
}

export class EnumField<O, T> extends Field<O, T> {
	type: FieldType = FieldType.ENUM;
}

export class NumericalField<O> extends RangeField<O, number> {
	type: FieldType = FieldType.NUMERICAL;
}

export class DateField<O> extends RangeField<O, Date> {
	type: FieldType = FieldType.DATE;
}

export class StringField<O> extends LikeField<O, string> {
	type: FieldType = FieldType.STRING;
}

export class BinaryField<O> extends LikeField<O, Buffer> {
	type: FieldType = FieldType.BINARY;
}
