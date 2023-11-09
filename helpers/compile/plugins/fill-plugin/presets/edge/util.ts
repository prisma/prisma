export function inspect(thing: unknown) {
  return console.log(thing)
}

export function promisify(fn: Function) {
  return function (...args: any[]) {
    return new Promise((resolve, reject) => {
      fn(...args, (error?: Error | null, value?: any) => {
        if (error) {
          return reject(error)
        }
        resolve(value)
      })
    })
  }
}

export function deprecate(fn: Function) {
  return fn
}

/**
 * A stub for util
 */
const util = {
  inspect,
  promisify,
  deprecate,
}

export default util
