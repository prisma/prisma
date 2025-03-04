/**
 * Returns unique elements of array
 * @param arr Array
 */

export function unique<T>(arr: T[]): T[] {
  const { length } = arr
  const result: T[] = []
  const seen = new Set() // just a cache

  for (let i = 0; i < length; i++) {
    const value = arr[i]
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }

  return result
}
