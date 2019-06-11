import { SyntaxDefinition } from '../types'

export const dml: SyntaxDefinition = {
  entity: [/model\s+\w+/g, /enum\s+\w+/g, /datasource\s+\w+/g, /source\s+\w+/g],
  comment: /#.*/g,
  directive: { pattern: /(@.*)/g },
  value: [/\"(.*)\"/g, /\b\s+(\w+)/g],
  punctuation: /(\:|}|{|"|=)/g,
  boolean: /(true|false)/g,
}
