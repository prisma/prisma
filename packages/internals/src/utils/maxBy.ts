export function maxBy<T>(items: T[], callback: (item: T) => number): T | undefined {
  if (items.length === 0) {
    return undefined
  }
  let result = items[0]
  let max = callback(items[0])

  for (let i = 1; i < items.length; i++) {
    const value = callback(items[i])
    if (value > max) {
      max = value
      result = items[i]
    }
  }
  return result
}
