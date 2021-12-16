export type SyntaxCondition =
  | RegExp
  | {
      pattern: RegExp
      greedy?: boolean
      lookbehind?: boolean
    }

export type SyntaxDefinition = {
  comment?: SyntaxCondition | Array<SyntaxCondition>
  variable?: SyntaxCondition | Array<SyntaxCondition>
  string?: SyntaxCondition | Array<SyntaxCondition>
  function?: SyntaxCondition | Array<SyntaxCondition>
  keyword?: SyntaxCondition | Array<SyntaxCondition>
  boolean?: SyntaxCondition | Array<SyntaxCondition>
  number?: SyntaxCondition | Array<SyntaxCondition>
  operator?: SyntaxCondition | Array<SyntaxCondition>
  punctuation?: SyntaxCondition | Array<SyntaxCondition>
  directive?: SyntaxCondition | Array<SyntaxCondition>
  entity?: SyntaxCondition | Array<SyntaxCondition>
  value?: SyntaxCondition | Array<SyntaxCondition>
  field?: SyntaxCondition | Array<SyntaxCondition>
}

export type Theme = {
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
  field?: (str: string) => string
}
