export function now() {
  const now = new Date()
  return `${now.getFullYear()}${prefixZero(now.getMonth() + 1)}${prefixZero(now.getDate())}${prefixZero(
    now.getHours(),
  )}${prefixZero(now.getMinutes())}${prefixZero(now.getSeconds())}`
}

const prefixZero = (value: number) => ('0' + value).slice(-2)
