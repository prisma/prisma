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
 * Emulate a private property via a WeakMap manually. Using native private
 * properties is a breaking change for downstream users with minimal TypeScript
 * configs, because TypeScript uses ES3 as the default target.
 *
 * TODO: replace this with a `#representation` private property in the
 * `ObjectEnumValue` class and document minimal required `target` for TypeScript.
 */
const representations = new WeakMap<ObjectEnumValue, string>()

/**
 * Base class for unique values of object-valued enums.
 */
export abstract class ObjectEnumValue {
  constructor(arg?: symbol) {
    if (arg === secret) {
      representations.set(this, `Prisma.${this._getName()}`)
    } else {
      representations.set(this, `new Prisma.${this._getNamespace()}.${this._getName()}()`)
    }
  }

  abstract _getNamespace(): string

  _getName() {
    return this.constructor.name
  }

  toString() {
    return representations.get(this)!
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
