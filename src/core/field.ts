import { FieldExclusion, FieldType } from "./enums";
import {
	BetweenFilterNode, EqualFilterNode, FieldValue, GreaterThanEqualFilterNode, GreaterThanFilterNode,
	InFilterNode, IsNotNullFilterNode, IsNullFilterNode, LessThanEqualFilterNode, LessThanFilterNode,
	LikeFilterNode, NotBetweenFilterNode, NotEqualFilterNode, NotInFilterNode, NotLikeFilterNode
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
		this.mapper = buildFieldMapper(path, mapper);
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

	eq(value: FieldValue<T>): EqualFilterNode<T> {
		return new EqualFilterNode(this, value);
	}
	neq(value: FieldValue<T>): NotEqualFilterNode<T> {
		return new NotEqualFilterNode(this, value);
	}

	in(...values: Array<FieldValue<T>>): InFilterNode<T> {
		return new InFilterNode(this, values);
	}
	notIn(...values: Array<FieldValue<T>>): NotInFilterNode<T> {
		return new NotInFilterNode(this, values);
	}

	isNull(): IsNullFilterNode<T> {
		return new IsNullFilterNode(this);
	}
	isNotNull(): IsNotNullFilterNode<T> {
		return new IsNotNullFilterNode(this);
	}

	toString(): string {
		return this.columnAs;
	}
}

export abstract class ComparableField<O, T> extends Field<O, T> {
	gt(value: FieldValue<T>): GreaterThanFilterNode<T> {
		return new GreaterThanFilterNode(this, value);
	}
	gte(value: FieldValue<T>): GreaterThanEqualFilterNode<T> {
		return new GreaterThanEqualFilterNode(this, value);
	}
	lt(value: FieldValue<T>): LessThanFilterNode<T> {
		return new LessThanFilterNode(this, value);
	}
	lte(value: FieldValue<T>): LessThanEqualFilterNode<T> {
		return new LessThanEqualFilterNode(this, value);
	}
}

export abstract class RangeField<O, T> extends ComparableField<O, T> {
	between(min: FieldValue<T>, max: FieldValue<T>): BetweenFilterNode<T> {
		return new BetweenFilterNode(this, [min, max]);
	}
	notBetween(min: FieldValue<T>, max: FieldValue<T>): NotBetweenFilterNode<T> {
		return new NotBetweenFilterNode(this, [min, max]);
	}
}

export abstract class LikeField<O, T> extends ComparableField<O, T> {
	like(value: FieldValue<T>): LikeFilterNode<T> {
		return new LikeFilterNode(this, value);
	}
	notLike(value: FieldValue<T>): NotLikeFilterNode<T> {
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

function buildFieldMapper<T>(path: string[], mapper?: FieldMapper<T>): FieldMapper<T> {
	let rawMapper: FieldMapper<T> = (model) => {
		return path.reduce((memo, piece) => {
			return memo != null ? memo[piece] : memo;
		}, model) as T;
	};

	if (mapper != null) {
		return (model) => {
			let mapperValue: T | undefined = mapper(model);
			if (mapperValue === undefined) {
				return rawMapper(model);
			}
			return mapperValue;
		};
	}

	return rawMapper;
}
