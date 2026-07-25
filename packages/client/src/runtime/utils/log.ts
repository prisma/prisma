import { inspect } from 'util'

type Options = {
  depth?: number
}

// this utility is used for jest, which overrides console.dir
// and doesn't allow to specify `depth`
export function clog(value, options?: Options) {
  const depth = options?.depth ?? 4
  console.debug(inspect(value, { depth }))
}

export function truncateMiddle(str: string, maxLength: number): string {
  if (typeof str !== 'string' || str.length <= maxLength || maxLength <= 3) {
    return str
  }
  const charsToShow = Math.ceil((maxLength - 3) / 2)
  const backChars = Math.floor((maxLength - 3) / 2)
  return `${str.slice(0, charsToShow)}...${str.slice(str.length - backChars)}`
}
