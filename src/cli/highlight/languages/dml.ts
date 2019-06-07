import { SyntaxDefinition } from '../types'

export const dml: SyntaxDefinition = {
  entity: [/model\s+\w+/g, /enum\s+\w+/g],
  value: { pattern: /\b\s(\w+)/g },
  punctuation: /(\:|}|{)/g,
  directive: { pattern: /(@.*)/g },
  comment: /#.*/g,
}
