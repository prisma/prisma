/**
 * Returns unique elements of array
 * @param arr Array
 */

export function uniqueBy<T>(arr: T[], callee: (element: T) => string): T[] {
  const result: { [key: string]: T } = {}

  for (const value of arr) {
    const hash = callee(value)
    if (!result[hash]) {
      result[hash] = value
    }
  }

  return Object.values(result)
}
