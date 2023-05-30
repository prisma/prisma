export function isDate(value: unknown): value is Date {
  return (
    value instanceof Date ||
    // date created in other JS context (for example, worker)
    Object.prototype.toString.call(value) === '[object Date]'
  )
}

export function isValidDate(date: Date) {
  return date.toString() !== 'Invalid Date'
}
