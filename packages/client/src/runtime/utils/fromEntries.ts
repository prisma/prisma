export function fromEntries<T>(iterable: Array<[string, T]>): {
  [key: string]: T
} {
  return [...iterable].reduce<{ [key: string]: T }>((obj, [key, val]) => {
    obj[key] = val
    return obj
  }, {})
}
