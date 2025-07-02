/**
 * Converts the first character of a word to upper case.
 */
export function capitalize<T extends string>(self: T): Capitalize<T> {
  if (self.length === 0) return self as Capitalize<T>

  return (self[0].toUpperCase() + self.slice(1)) as Capitalize<T>
}

/**
 * Converts the first character of a word to lower case.
 */
export function uncapitalize<T extends string>(self: T): Uncapitalize<T> {
  return (self.substring(0, 1).toLowerCase() + self.substring(1)) as Uncapitalize<T>
}
