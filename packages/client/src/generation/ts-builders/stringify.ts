import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

type StringifyOptions = {
  indentLevel?: number
}

export function stringify(builder: BasicBuilder, { indentLevel = 0 }: StringifyOptions = {}) {
  return new Writer(indentLevel).write(builder).toString()
}
