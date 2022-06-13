import indent from 'indent-string'

import { DMMF } from '../../runtime/dmmf-types'
import { TAB_SIZE } from './constants'
import { Generatable } from './Generatable'

/**
 * List of Prisma enums that must use symbols instead of strings as their values.
 */
export const symbolEnums = ['JsonNullValueInput', 'NullableJsonNullValueInput', 'JsonNullValueFilter']

export class Symbols implements Generatable {
  private symbolNames = new Set<string>()

  constructor(dmmf: DMMF.Document) {
    for (const prismaEnum of dmmf.schema.enumTypes.prisma) {
      if (symbolEnums.includes(prismaEnum.name)) {
        for (const value of prismaEnum.values) {
          this.symbolNames.add(value)
        }
      }
    }
  }

  toTS(): string {
    const lines = Array.from(this.symbolNames)
      .map((symbol) => `export const ${symbol}: unique symbol\nexport type ${symbol} = typeof ${symbol}`)
      .join('\n')
    const indentedLines = indent(lines, TAB_SIZE)
    return `export namespace Symbols {\n${indentedLines}\n}`
  }

  toJS(): string {
    const symbols = Array.from(this.symbolNames)
      .map((symbol) => `Prisma.Symbols.${symbol} = Symbol.for('${symbol}')`)
      .join('\n')
    return `Prisma.Symbols = {}\n${symbols}`
  }
}
