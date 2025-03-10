export function resolve(...args: any[]) {
  return args.join('/')
}

export function join(...args: any[]) {
  return args.join('/')
}

export function parse(path: string) {
  const base = basename(path)
  const dir = dirname(path)
  const [name, ext] = base.split('.')
  return { root: '/', dir, base, ext, name }
}

export function basename(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

export function dirname(path: string) {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
}

export const sep = '/'

export const posix = {
  sep,
}

/**
 * A poor man's shim for the "path" module
 */
const path = {
  basename,
  dirname,
  join,
  parse,
  posix,
  resolve,
  sep,
}

export default path
