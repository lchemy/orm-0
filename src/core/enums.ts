// TODO: aggregate functions?

export enum FilterOperator {
	EQ,
	NEQ,
	GT,
	GTE,
	LT,
	LTE,
	LIKE,
	NOT_LIKE,
	BETWEEN,
	NOT_BETWEEN,
	IN,
	NOT_IN,
	IS_NULL,
	IS_NOT_NULL,
	EXISTS,
	NOT_EXISTS
};

export enum FilterGrouping {
	AND,
	OR
};

export enum SortDirection {
	DESCENDING,
	ASCENDING
};

export enum FieldExclusion {
	INCLUDE,
	EXCLUDE,
	ISOLATE
};

export enum FieldType {
	BOOLEAN,
	DATE,
	ENUM,
	NUMERICAL,
	STRING,
	BINARY
};
