function flatten(array) {
  return Array.prototype.concat.apply([], array)
}

export function flatMap<T, U>(
  array: T[],
  callbackFn: (value: T, index: number, array: T[]) => U[],
  thisArg?: any,
): U[] {
  return flatten(array.map(callbackFn, thisArg))
}
