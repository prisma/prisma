/**
 * Merge two arrays, their elements uniqueness decided by the callback.
 * In case of a duplicate, elements of `arr2` are taken.
 * If there is a duplicate within an array, the last element is being taken.
 * @param arr1 Base array
 * @param arr2 Array to overwrite the first one if there is a match
 * @param cb The function to calculate uniqueness
 */
export function mergeBy<T>(arr1: T[], arr2: T[], cb: (element: T) => string): T[] {
  const groupedArr1 = groupBy(arr1, cb)
  const groupedArr2 = groupBy(arr2, cb)
  const result: T[] = Object.values(groupedArr2).map((value) => value[value.length - 1])

  const arr2Keys = Object.keys(groupedArr2)
  Object.entries(groupedArr1).forEach(([key, value]) => {
    if (!arr2Keys.includes(key)) {
      result.push(value[value.length - 1])
    }
  })

  return result
}

const groupBy = <T>(arr: T[], cb: (element: T) => string): { [key: string]: T[] } => {
  return arr.reduce<{ [key: string]: T[] }>((acc, curr) => {
    const key = cb(curr)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(curr)
    return acc
  }, {})
}
