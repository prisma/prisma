import { Prism, Token } from './prism'
import type { SyntaxDefinition } from './types'

export function highlightTS(str: string) {
  if (TARGET_BUILD_TYPE === 'edge') {
    return str
  } else {
    return highlight(str, Prism.languages.javascript)
  }
}

function highlight(str: string, grammar: SyntaxDefinition) {
  const tokens = Prism.tokenize(str, grammar)
  return tokens.map((t) => Token.stringify(t)).join('')
}
