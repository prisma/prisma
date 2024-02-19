export function promisify(fn: (...args: any[]) => any) {
  return (...args: any[]) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err: any, result: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    })
  }
}

export function deprecate(fn: (...args: any[]) => any, message: string) {
  return (...args: any[]) => {
    console.warn(message)
    return fn(...args)
  }
}

// does not handle recursive objects or colors
export function inspect(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function') {
      return value.toString()
    }
    if (typeof value === 'bigint') {
      return `${value}n`
    }
    if (value instanceof Error) {
      return {
        ...value,
        message: value.message,
        stack: value.stack,
      }
    }

    return value
  })
}

export const format = require('format-util')!

/**
 * A poor man's shim for the "util" module
 */
const util = {
  promisify,
  deprecate,
  inspect,
  format,
}

export default util
