/**
 * Based on the TS documentation for class mixins.
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html
 * @param derivedCtor
 * @param constructors
 */
export function applyMixins(derivedCtor: any, constructors: any[]) {
  for (const baseCtor of constructors) {
    for (const name of Object.getOwnPropertyNames(baseCtor.prototype)) {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ?? (Object.create(null) as PropertyDescriptor),
      )
    }
  }
}
