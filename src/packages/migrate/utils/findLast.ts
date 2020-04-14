export function findLast<T>(array: T[], iteratee: (element: T) => boolean | undefined): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    const element = array[i]
    if (iteratee(element)) {
      return element
    }
  }

  return undefined
}
