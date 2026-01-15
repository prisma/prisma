/**
 * Chevrotain-based Prisma Schema Language Lexer
 */

import { createToken, type ILexingError, IToken, Lexer as ChevrotainLexer } from 'chevrotain'

// Identifiers and literals - declare first for reference
export const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ })

// Keywords
export const Model = createToken({ name: 'Model', pattern: /model/, longer_alt: Identifier })
export const Enum = createToken({ name: 'Enum', pattern: /enum/, longer_alt: Identifier })
export const DataSource = createToken({ name: 'DataSource', pattern: /datasource/, longer_alt: Identifier })
export const Generator = createToken({ name: 'Generator', pattern: /generator/, longer_alt: Identifier })
export const Type = createToken({ name: 'Type', pattern: /type/, longer_alt: Identifier })
export const View = createToken({ name: 'View', pattern: /view/, longer_alt: Identifier })

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/,
  line_breaks: false,
})
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
})

// Punctuation
export const LBrace = createToken({ name: 'LBrace', pattern: /{/ })
export const RBrace = createToken({ name: 'RBrace', pattern: /}/ })
export const LParen = createToken({ name: 'LParen', pattern: /\(/ })
export const RParen = createToken({ name: 'RParen', pattern: /\)/ })
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ })
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ })
export const AtAt = createToken({ name: 'AtAt', pattern: /@@/ })
export const At = createToken({ name: 'At', pattern: /@/, longer_alt: AtAt })
export const Equals = createToken({ name: 'Equals', pattern: /=/ })
export const Question = createToken({ name: 'Question', pattern: /\?/ })
export const Comma = createToken({ name: 'Comma', pattern: /,/ })
export const Dot = createToken({ name: 'Dot', pattern: /\./ })
export const Colon = createToken({ name: 'Colon', pattern: /:/ })

// Comments and whitespace
export const SingleLineComment = createToken({
  name: 'SingleLineComment',
  pattern: /\/\/[^\r\n]*/,
  group: ChevrotainLexer.SKIPPED,
})

export const MultiLineComment = createToken({
  name: 'MultiLineComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: ChevrotainLexer.SKIPPED,
})

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: ChevrotainLexer.SKIPPED,
})

// Token list (order matters for precedence)
export const allTokens = [
  WhiteSpace,
  SingleLineComment,
  MultiLineComment,

  // Keywords (must come before Identifier)
  Model,
  Enum,
  DataSource,
  Generator,
  Type,
  View,

  // Literals and identifiers
  NumberLiteral,
  StringLiteral,
  Identifier,

  // Multi-character punctuation (must come before single-character)
  AtAt,

  // Single-character punctuation
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  At,
  Equals,
  Question,
  Comma,
  Dot,
  Colon,
]

export const SchemaLexer = new ChevrotainLexer(allTokens, {
  // Uncomment this to see token recognition debug info
  // positionTracking: "full"
})

// Export for external use
export type { IToken }

/**
 * Tokenize a Prisma schema string
 */
export function tokenizeSchema(text: string): { tokens: IToken[]; errors: ILexingError[] } {
  const lexingResult = SchemaLexer.tokenize(text)

  return {
    tokens: lexingResult.tokens,
    errors: lexingResult.errors,
  }
}
