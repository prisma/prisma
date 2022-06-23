function flatten(array) {
  return Array.prototype.concat.apply([], array)
}

// TODO: Array.flatMap is available since Node.js 11.
// Our currently minimum Node.js version supported is Node.js 12.
export function flatMap<T, U>(array: T[], callbackFn: (value: T, index: number, arr: T[]) => U[], thisArg?: any): U[] {
  return flatten(array.map(callbackFn, thisArg))
}
