import type { DMMF } from '../dmmf-types'

export function argIsInputType(arg: DMMF.ArgType): arg is DMMF.InputType {
  if (typeof arg === 'string') {
    return false
  }

  return true
}
