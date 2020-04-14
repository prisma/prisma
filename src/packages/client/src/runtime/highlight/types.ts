export type SyntaxCondition =
  | RegExp
  | {
      pattern: RegExp
      greedy?: boolean
      lookbehind?: boolean
    }

export interface SyntaxDefinition {
  comment?: SyntaxCondition | SyntaxCondition[]
  variable?: SyntaxCondition | SyntaxCondition[]
  string?: SyntaxCondition | SyntaxCondition[]
  function?: SyntaxCondition | SyntaxCondition[]
  keyword?: SyntaxCondition | SyntaxCondition[]
  boolean?: SyntaxCondition | SyntaxCondition[]
  number?: SyntaxCondition | SyntaxCondition[]
  operator?: SyntaxCondition | SyntaxCondition[]
  punctuation?: SyntaxCondition | SyntaxCondition[]
  directive?: SyntaxCondition | SyntaxCondition[]
  entity?: SyntaxCondition | SyntaxCondition[]
  value?: SyntaxCondition | SyntaxCondition[]
}

export interface Theme {
  comment: (str: string) => string
  variable?: (str: string) => string
  string?: (str: string) => string
  function?: (str: string) => string
  keyword?: (str: string) => string
  boolean?: (str: string) => string
  number?: (str: string) => string
  operator?: (str: string) => string
  punctuation?: (str: string) => string
  directive?: (str: string) => string
  entity?: (str: string) => string
  value?: (str: string) => string
}
