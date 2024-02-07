export function resolve(...args: any[]) {
  return args.join('/')
}

export function join(...args: any[]) {
  return args.join('/')
}

export const sep = '/'

export const posix = {
  sep,
}

/**
 * A poor man's shim for the "path" module
 */
const path = {
  resolve,
  posix,
  join,
  sep,
}

export default path
