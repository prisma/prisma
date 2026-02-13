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

/**
 * See helper in @internals package. Can not be used here
 * because importing internal breaks browser build.
 *
 * @param classObject
 * @param name
 */
function setClassName(classObject: Function, name: string) {
  Object.defineProperty(classObject, 'name', {
    value: name,
    configurable: true,
  })
}

class NullTypesEnumValue extends ObjectEnumValue {
  override _getNamespace() {
    return 'NullTypes'
  }
}

export class DbNullClass extends NullTypesEnumValue {
  // Phantom private property to prevent structural type equality
  // eslint-disable-next-line no-unused-private-class-members
  readonly #_brand_DbNull!: void
}
setClassName(DbNullClass, 'DbNull')

export class JsonNullClass extends NullTypesEnumValue {
  // Phantom private property to prevent structural type equality
  // eslint-disable-next-line no-unused-private-class-members
  readonly #_brand_JsonNull!: void
}
setClassName(JsonNullClass, 'JsonNull')

export class AnyNullClass extends NullTypesEnumValue {
  // Phantom private property to prevent structural type equality
  // eslint-disable-next-line no-unused-private-class-members
  readonly #_brand_AnyNull!: void
}
setClassName(AnyNullClass, 'AnyNull')

export const NullTypes = {
  DbNull: DbNullClass,
  JsonNull: JsonNullClass,
  AnyNull: AnyNullClass,
}

export const DbNull = new DbNullClass(secret)
export const JsonNull = new JsonNullClass(secret)
export const AnyNull = new AnyNullClass(secret)

/**
 * Check if a value is the DBNull singleton instance.
 */
export function isDbNull(value: unknown): value is DbNullClass {
  return value === DbNull
}

/**
 * Check if a value is the JsonNull singleton instance.
 */
export function isJsonNull(value: unknown): value is JsonNullClass {
  return value === JsonNull
}

/**
 * Check if a value is the AnyNull singleton instance.
 */
export function isAnyNull(value: unknown): value is AnyNullClass {
  return value === AnyNull
}
