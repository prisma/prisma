/**
 * List of Prisma enums that must use unique objects instead of strings as their values.
 */
export const symbolEnumNames = ['JsonNullValueInput', 'NullableJsonNullValueInput', 'JsonNullValueFilter']

export class ObjectEnumValue {
  getTypeName() {
    return this.constructor.name
  }

  toString() {
    return `Prisma.${this.getTypeName()}`
  }
}

export class DbNull extends ObjectEnumValue {
  private _DbNull = true
}

export class JsonNull extends ObjectEnumValue {
  private _JsonNull = true
}

export class AnyNull extends ObjectEnumValue {
  private _AnyNull = true
}

export const enumValues = {
  DbNull: new DbNull(),
  JsonNull: new JsonNull(),
  AnyNull: new AnyNull(),
}
