/**
 * List of Prisma enums that must use unique objects instead of strings as their values.
 */
export const objectEnumNames = ['JsonNullValueInput', 'NullableJsonNullValueInput', 'JsonNullValueFilter']

/**
 * Base class for unique values of object-valued enums.
 */
export class ObjectEnumValue {
  _getName() {
    return this.constructor.name
  }

  toString() {
    return `Prisma.${this._getName()}`
  }
}

class DbNull extends ObjectEnumValue {}

class JsonNull extends ObjectEnumValue {}

class AnyNull extends ObjectEnumValue {}

export const objectEnumValues = {
  classes: {
    DbNull,
    JsonNull,
    AnyNull,
  },
  instances: {
    DbNull: new DbNull(),
    JsonNull: new JsonNull(),
    AnyNull: new AnyNull(),
  },
}
