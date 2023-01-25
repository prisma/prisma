import Decimal from 'decimal.js'

import { DMMF } from '../../dmmf-types'
import { FieldRef } from '../model/FieldRef'

export type Action = keyof typeof DMMF.ModelAction | 'executeRaw' | 'queryRaw' | 'runCommandRaw'

type JsInputValue =
  | null
  | undefined
  | string
  | number
  | boolean
  | bigint
  | Date
  | Decimal
  | FieldRef<unknown, unknown>
  | JsInputValue[]
  | { [key: string]: JsInputValue }

export type JsArgs = {
  select?: Selection
  include?: Selection
  [argName: string]: JsInputValue
}

export type Selection = Record<string, boolean | JsArgs>
