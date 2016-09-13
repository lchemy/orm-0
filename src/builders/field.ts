import {
	Orm, Field, FieldType,
	BooleanField, EnumField, NumericalField, DateField, StringField, BinaryField
} from "../core";
import { FieldDefinition } from "../definitions";

export function buildField<O extends Orm, T>(orm: O, path: string[], definition: FieldDefinition<T>): Field<O, T> {
	let ctor: typeof Field;
	switch (definition.type) {
		case FieldType.BOOLEAN:
			ctor = BooleanField;
			break;
		case FieldType.ENUM:
			ctor = EnumField;
			break;
		case FieldType.NUMERICAL:
			ctor = NumericalField;
			break;
		case FieldType.DATE:
			ctor = DateField;
			break;
		case FieldType.STRING:
			ctor = StringField;
			break;
		case FieldType.BINARY:
			ctor = BinaryField;
			break;
		default:
			// TODO: error
			throw new Error();
	}
	return (new (ctor as any)(orm, path, definition.column, definition.exclusivity, definition.mapper)) as Field<O, T>;
}
