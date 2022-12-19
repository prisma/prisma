import { Omit } from './Omit'

export function Patch(O1: string, O2: string, KName = 'P') {
  return `(${O1}) & ${Omit(O2, `keyof (${O1})`, KName)}`
}
