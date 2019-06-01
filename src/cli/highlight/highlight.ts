import { SyntaxDefinition } from './types'
import { Prism, Token } from './prism'
import { dml } from './languages/dml'
import { sql } from './languages/sql'

export function highlightDatamodel(str: string) {
  return highlight(str, dml)
}
export function highlightSql(str: string) {
  return highlight(str, sql)
}

function highlight(str: string, grammar: SyntaxDefinition) {
  const tokens = Prism.tokenize(str, grammar)
  return tokens.map(t => Token.stringify(t)).join('')
}
