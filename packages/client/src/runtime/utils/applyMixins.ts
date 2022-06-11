/**
 * Copied from the TS documentation for class mixins.
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html
 * @param derivedCtor
 * @param constructors
 */
export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null),
      )
    })
  })
}
