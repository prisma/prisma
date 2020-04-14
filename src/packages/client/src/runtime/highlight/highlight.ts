import { Prism, Token } from './prism'
import { SyntaxDefinition } from './types'

export function highlightTS(str: string) {
  return highlight(str, Prism.languages.javascript)
}

function highlight(str: string, grammar: SyntaxDefinition) {
  const tokens = Prism.tokenize(str, grammar)
  return tokens.map(t => Token.stringify(t)).join('')
}
