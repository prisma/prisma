/**
 * List of Prisma enums that must use unique objects instead of strings as their values.
 */
export const symbolEnumNames = ['JsonNullValueInput', 'NullableJsonNullValueInput', 'JsonNullValueFilter']

class EnumValue {
  toString() {
    return `Prisma.${this.constructor.name}`
  }
}

export const enumValues = {
  DbNull: new (class DbNull extends EnumValue {})(),
  JsonNull: new (class JsonNull extends EnumValue {})(),
  AnyNull: new (class AnyNull extends EnumValue {})(),
}
