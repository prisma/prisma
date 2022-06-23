const prefixZero = (value: number): string => ('0' + value).slice(-2)

export function now(): string {
  const _now = new Date()
  return `${_now.getFullYear()}${prefixZero(_now.getMonth() + 1)}${prefixZero(_now.getDate())}${prefixZero(
    _now.getHours(),
  )}${prefixZero(_now.getMinutes())}${prefixZero(_now.getSeconds())}`
}

export function timestampToDate(timestamp: string): Date | undefined {
  if (!timestamp || timestamp.length !== 14) {
    return undefined
  }
  const year = Number(timestamp.slice(0, 4))
  const month = Number(timestamp.slice(4, 6))
  const date = Number(timestamp.slice(6, 8))
  const hours = Number(timestamp.slice(8, 10))
  const minutes = Number(timestamp.slice(10, 12))
  const seconds = Number(timestamp.slice(12, 14))

  return new Date(year, month - 1, date, hours, minutes, seconds)
}

export function renderDate(date: Date): string {
  if (date.getDate() !== new Date().getDate()) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }
  return date.toLocaleTimeString()
}
