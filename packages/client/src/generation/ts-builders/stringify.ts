import { assertNever } from '@prisma/internals'

import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

type StringifyOptions = {
  indentLevel?: number
  newLine?: 'none' | 'leading' | 'trailing' | 'both'
}

export function stringify(builder: BasicBuilder, { indentLevel = 0, newLine = 'none' }: StringifyOptions = {}) {
  const str = new Writer(indentLevel).write(builder).toString()
  switch (newLine) {
    case 'none':
      return str
    case 'leading':
      return '\n' + str
    case 'trailing':
      return str + '\n'
    case 'both':
      return '\n' + str + '\n'
    default:
      assertNever(newLine, 'Unexpected value')
  }
}
