/**
 * Module-private symbol used to distinguish between instances of
 * `ObjectEnumValue` created inside and outside this module.
 */
const secret = Symbol()

/**
 * Global symbol used to identify Prisma null type instances across module boundaries.
 * Symbol.for() returns the same symbol globally, which is essential for HMR scenarios
 * where the module may be reloaded but we need to recognize instances created before
 * the reload. See: https://github.com/prisma/prisma/issues/28947
 */
const PRISMA_NULL_TYPE = Symbol.for('prisma.nullType')

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
  // Marker for cross-module HMR compatibility
  readonly [PRISMA_NULL_TYPE] = 'DbNull' as const
}
setClassName(DbNullClass, 'DbNull')

export class JsonNullClass extends NullTypesEnumValue {
  // Phantom private property to prevent structural type equality
  // eslint-disable-next-line no-unused-private-class-members
  readonly #_brand_JsonNull!: void
  // Marker for cross-module HMR compatibility
  readonly [PRISMA_NULL_TYPE] = 'JsonNull' as const
}
setClassName(JsonNullClass, 'JsonNull')

export class AnyNullClass extends NullTypesEnumValue {
  // Phantom private property to prevent structural type equality
  // eslint-disable-next-line no-unused-private-class-members
  readonly #_brand_AnyNull!: void
  // Marker for cross-module HMR compatibility
  readonly [PRISMA_NULL_TYPE] = 'AnyNull' as const
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
 * Check if a value is the DbNull singleton instance.
 * Uses Symbol.for() marker for cross-module HMR compatibility.
 */
export function isDbNull(value: unknown): value is DbNullClass {
  return (value as Record<symbol, unknown>)?.[PRISMA_NULL_TYPE] === 'DbNull'
}

/**
 * Check if a value is the JsonNull singleton instance.
 * Uses Symbol.for() marker for cross-module HMR compatibility.
 */
export function isJsonNull(value: unknown): value is JsonNullClass {
  return (value as Record<symbol, unknown>)?.[PRISMA_NULL_TYPE] === 'JsonNull'
}

/**
 * Check if a value is the AnyNull singleton instance.
 * Uses Symbol.for() marker for cross-module HMR compatibility.
 */
export function isAnyNull(value: unknown): value is AnyNullClass {
  return (value as Record<symbol, unknown>)?.[PRISMA_NULL_TYPE] === 'AnyNull'
}
