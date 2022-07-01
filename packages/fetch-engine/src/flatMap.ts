function flatten<T>(array: T[]): [] {
  // @ts-ignore
  return Array.prototype.concat.apply([], array)
}

export function flatMap<T, U>(
  array: T[],
  callbackFn: (value: T, index: number, array: T[]) => U[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thisArg?: any,
): U[] {
  return flatten(array.map(callbackFn, thisArg))
}
