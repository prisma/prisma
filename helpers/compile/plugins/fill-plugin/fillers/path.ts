export function resolve(...args: any[]) {
  return args.join('/')
}

export function join(...args: any[]) {
  return args.join('/')
}

export const sep = '/'

/**
 * A poor man's shim for the "path" module
 */
const path = {
  resolve,
  join,
  sep,
}

export default path
