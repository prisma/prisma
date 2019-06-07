import { SyntaxDefinition } from '../types'

export const dml: SyntaxDefinition = {
  entity: [/model\s+\w+/g, /enum\s+\w+/g],
  punctuation: /(\:|}|{)/g,
  comment: /#.*/g,
  directive: { pattern: /(@.*)/g },
  value: { pattern: /\b\s+(\w+)/g },
}
