/**
 * List of Prisma enums that must use unique objects instead of strings as their values.
 */
export const symbolEnumNames = ['JsonNullValueInput', 'NullableJsonNullValueInput', 'JsonNullValueFilter']

export class ObjectEnumValue {
  _getName() {
    return this.constructor.name
  }

  toString() {
    return `Prisma.${this._getName()}`
  }
}

export class DbNull extends ObjectEnumValue {}

export class JsonNull extends ObjectEnumValue {}

export class AnyNull extends ObjectEnumValue {}

export const enumValues = {
  DbNull: new DbNull(),
  JsonNull: new JsonNull(),
  AnyNull: new AnyNull(),
}
