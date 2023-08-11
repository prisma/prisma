export const strictEnumNames = ['TransactionIsolationLevel']

/**
 * List of properties that won't throw exception on access and return undefined instead
 */
const allowList = new Set([
  'toJSON', // used by JSON.stringify
  '$$typeof', // used by old React tooling
  'asymmetricMatch', // used by Jest
  Symbol.iterator, // used by various JS constructs/methods
  Symbol.toStringTag, // Used by .toString()
  Symbol.isConcatSpreadable, // Used by Array#concat,
  Symbol.toPrimitive, // Used when getting converted to primitive values
])
/**
 * Generates more strict variant of an enum which, unlike regular enum,
 * throws on non-existing property access. This can be useful in following situations:
 * - we have an API, that accepts both `undefined` and `SomeEnumType` as an input
 * - enum values are generated dynamically from DMMF.
 *
 * In that case, if using normal enums and no compile-time typechecking, using non-existing property
 * will result in `undefined` value being used, which will be accepted. Using strict enum
 * in this case will help to have a runtime exception, telling you that you are probably doing something wrong.
 *
 * Note: if you need to check for existence of a value in the enum you can still use either
 * `in` operator or `hasOwnProperty` function.
 *
 * @param definition
 * @returns
 */
export function makeStrictEnum<T extends Record<PropertyKey, string | number>>(definition: T): T {
  return new Proxy(definition, {
    get(target, property) {
      if (property in target) {
        return target[property]
      }
      if (allowList.has(property)) {
        return undefined
      }
      throw new TypeError(`Invalid enum value: ${String(property)}`)
    },
  })
}
