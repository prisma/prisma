import { inspect } from 'node:util'

type Options = {
  depth?: number
}

// this utility is used for jest, which overrides console.dir
// and doesn't allow to specify `depth`
export function clog(value, options?: Options) {
  const depth = options?.depth ?? 4
  console.debug(inspect(value, { depth }))
}
