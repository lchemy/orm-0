import {
	Orm, Field, FieldType, FieldExclusion, FieldMapper,
	BooleanField, EnumField, NumericalField, DateField, StringField, BinaryField
} from "../core";

export class FieldDefinition<T> {
	type: FieldType;
	column: string;
	exclusivity: FieldExclusion;
	mapper?: FieldMapper<T>;

	constructor(type: FieldType, column: string, exclusivity: FieldExclusion, mapper?: FieldMapper<T>) {
		this.type = type;
		this.column = column;
		this.exclusivity = exclusivity;
		this.mapper = mapper;
	}
}

type FieldDefiner<T> = (column: string, exclusivity?: FieldExclusion | boolean, mapper?: FieldMapper<T> | string) => FieldDefinition<T>;
export interface FieldDefinitions {
	Boolean: FieldDefiner<boolean>;
	Enum: FieldDefiner<any>;
	Numerical: FieldDefiner<number>;
	Date: FieldDefiner<Date>;
	String: FieldDefiner<string>;
	Binary: FieldDefiner<Buffer>;
}

export function normalizeExclusivity(exclusivity?: FieldExclusion | boolean, defaultExclusivity: FieldExclusion = FieldExclusion.INCLUDE): FieldExclusion {
	if (exclusivity == null) {
		return defaultExclusivity;
	}
	if (typeof exclusivity === "boolean") {
		return exclusivity ? FieldExclusion.INCLUDE : FieldExclusion.EXCLUDE;
	}
	return exclusivity;
}

export function normalizeMapper<T>(mapper?: FieldMapper<T> | string): FieldMapper<T> | undefined {
	if (mapper == null) {
		return mapper;
	}
	if (typeof mapper === "string") {
		let path: string[] = mapper.split(".");
		return (obj: Object): T => {
			return path.reduce((memo, piece) => {
				if (memo == null) {
					return memo;
				}
				return memo[piece];
			}, obj) as T;
		};
	}
	return mapper;
}

function fieldDefinitionFor<T>(type: FieldType): FieldDefiner<T> {
	return (column: string, exclusivity?: FieldExclusion | boolean, mapper?: FieldMapper<T> | string) => {
		return new FieldDefinition<T>(type, column, normalizeExclusivity(exclusivity), normalizeMapper(mapper));
	};
}

export const fieldDefinitions: FieldDefinitions = {
	Boolean: fieldDefinitionFor<boolean>(FieldType.BOOLEAN),
	Enum: fieldDefinitionFor<any>(FieldType.ENUM),
	Numerical: fieldDefinitionFor<number>(FieldType.NUMERICAL),
	Date: fieldDefinitionFor<Date>(FieldType.DATE),
	String: fieldDefinitionFor<string>(FieldType.STRING),
	Binary: fieldDefinitionFor<Buffer>(FieldType.BINARY)
};
