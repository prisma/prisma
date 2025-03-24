export interface Dictionary<T> {
  [key: string]: T
}

export function keyBy<P extends PropertyKey, T extends { [key in P]: string }>(
  collection: readonly T[],
  prop: P,
): Dictionary<T> {
  const acc: Dictionary<T> = {}

  for (const obj of collection) {
    const key = obj[prop]
    acc[key] = obj
  }

  return acc
}
