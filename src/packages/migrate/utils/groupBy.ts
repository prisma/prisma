import { Dictionary } from '../types'

export function groupBy<T>(arr: T[], iteratee: (element: T) => string): Dictionary<T[]> {
  const dict: Dictionary<T[]> = {}

  for (const element of arr) {
    const key = iteratee(element)
    if (!dict[key]) {
      dict[key] = [element]
    } else {
      dict[key].push(element)
    }
  }

  return dict
}
