import type { SyntaxDefinition } from '../types'

export const dml: SyntaxDefinition = {
  value: { pattern: /\:\s+(\w+)/g },
  punctuation: /(\:|}|{)/g,
  entity: /model\s+\w+/g,
  directive: { pattern: /(@.*)/g },
  comment: /#.*/g,
}
