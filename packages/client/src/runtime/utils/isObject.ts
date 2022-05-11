/**
 * If we have a union type let's say of DateTimeFilter | Date, we will be called by tryInferArg.
 * And there are a few false friends out there, like `[object Date]` `[object BigInt]` or `Buffer`.
 * All of them have `typeof value === 'object'`, however, they're not objects in the Prisma sense
 */
const notReallyObjects = {
  '[object Date]': true,
  '[object Uint8Array]': true, // for Buffers
  '[object Decimal]': true, // for Decimal
}

export function isObject(value: unknown): boolean {
  if (!value) {
    return false
  }
  return typeof value === 'object' && !notReallyObjects[Object.prototype.toString.call(value)]
}
