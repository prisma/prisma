/**
 * Accepts an array and comparator function (similar to Array.prototype.sort)
 * and returns max element of that array, ordered with that comparator.
 * Functionally, equivalent of items.sort(comparator).at(-1), but performed non-destructively
 * in O(n)
 * @param items
 * @param comparator callback specifying the relative order of two items. See `Array.prototype.sort`
 * @returns
 */
export function maxWithComparator<T>(items: T[], comparator: (a: T, b: T) => number): T | undefined {
  if (items.length === 0) {
    return undefined
  }
  let result = items[0]

  for (let i = 1; i < items.length; i++) {
    const compareValue = comparator(result, items[i])
    // comparator returning negative number means that b>a
    if (compareValue < 0) {
      result = items[i]
    }
  }
  return result
}

export function maxBy<T>(items: T[], callback: (item: T) => number): T | undefined {
  return maxWithComparator(items, (a, b) => callback(a) - callback(b))
}
