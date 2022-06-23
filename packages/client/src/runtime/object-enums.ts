/**
 * List of Prisma enums that must use unique objects instead of strings as their values.
 */
export const objectEnumNames = ['JsonNullValueInput', 'NullableJsonNullValueInput', 'JsonNullValueFilter']

/**
 * Module-private symbol used to distinguish between instances of
 * `ObjectEnumValue` created inside and outside this module.
 */
const secret = Symbol()

/**
 * Base class for unique values of object-valued enums.
 */
export abstract class ObjectEnumValue {
  #representation: string

  constructor(arg?: symbol) {
    if (arg === secret) {
      this.#representation = `Prisma.${this._getName()}`
    } else {
      this.#representation = `new Prisma.${this._getNamespace()}.${this._getName()}()`
    }
  }

  abstract _getNamespace(): string

  _getName() {
    return this.constructor.name
  }

  toString() {
    return this.#representation
  }
}

class NullTypesEnumValue extends ObjectEnumValue {
  override _getNamespace() {
    return 'NullTypes'
  }
}

class DbNull extends NullTypesEnumValue {}

class JsonNull extends NullTypesEnumValue {}

class AnyNull extends NullTypesEnumValue {}

export const objectEnumValues = {
  classes: {
    DbNull,
    JsonNull,
    AnyNull,
  },
  instances: {
    DbNull: new DbNull(secret),
    JsonNull: new JsonNull(secret),
    AnyNull: new AnyNull(secret),
  },
}
