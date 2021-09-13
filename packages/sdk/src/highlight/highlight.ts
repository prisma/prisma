import type { SyntaxDefinition } from './types'
import { Prism, Token } from './prism'
import { dml } from './languages/dml'
import { sql } from './languages/sql'

export function highlightDatamodel(str: string): any {
  return highlight(str, dml)
}
export function highlightSql(str: string): any {
  return highlight(str, sql)
}

export function highlightTS(str: string): any {
  return highlight(str, Prism.languages.javascript)
}

function highlight(str: string, grammar: SyntaxDefinition): any {
  const tokens = Prism.tokenize(str, grammar)
  return tokens.map((t) => Token.stringify(t)).join('')
}
