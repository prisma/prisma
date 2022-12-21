import { Omit } from './Omit'

export function Patch(O1: string, O2: string, KName = 'P') {
  return `(${O1}) & ${Omit(O2, `keyof (${O1})`, KName)}`
}

export function Patch3(O1: string, O2: string, O3: string, KName = 'P') {
  return `(${O1}) & ${Omit(O2, `keyof (${O1})`, KName)} & ${Omit(O3, `keyof (${O1}) | keyof (${O2})`, KName)}`
}
