import type { SyntaxDefinition } from '../types'

export const dml: SyntaxDefinition = {
  string: [/\"(.*)\"/g, /\'(.*)\'/g],
  directive: { pattern: /(@.*)/g },
  entity: [/model\s+\w+/g, /enum\s+\w+/g, /datasource\s+\w+/g, /source\s+\w+/g, /generator\s+\w+/g],
  comment: /#.*/g,
  value: [/\b\s+(\w+)/g],
  punctuation: /(\:|}|{|"|=)/g,
  boolean: /(true|false)/g,
}
