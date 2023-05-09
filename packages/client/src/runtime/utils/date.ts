export function isDate(value: unknown): value is Date {
  return Object.prototype.toString.call(value) === '[object Date]'
}

export function isValidDate(date: Date) {
  return date.toString() !== 'Invalid Date'
}
