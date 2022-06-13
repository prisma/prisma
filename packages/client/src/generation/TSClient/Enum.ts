import indent from 'indent-string'

import type { DMMF } from '../../runtime/dmmf-types'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import type { ExportCollector } from './helpers'
import { symbolEnums } from './Symbols'

export class Enum implements Generatable {
  constructor(
    protected readonly type: DMMF.SchemaEnum,
    protected readonly useNamespace: boolean,
    protected readonly collector?: ExportCollector,
  ) {
    if (useNamespace) {
      this.collector?.addSymbol(type.name)
    }
  }

  private isSymbolEnum(): boolean {
    return this.useNamespace && symbolEnums.includes(this.type.name)
  }

  public toJS(): string {
    const { type } = this
    return `exports.${this.useNamespace ? 'Prisma.' : ''}${type.name} = makeEnum({
${indent(type.values.map((v) => `${v}: ${this.getValueJS(v)}`).join(',\n'), TAB_SIZE)}
});`
  }

  private getValueJS(value: string): string {
    return this.isSymbolEnum() ? `Prisma.Symbols.${value}` : `'${value}'`
  }

  public toTS(): string {
    const { type } = this

    return `export const ${type.name}: {
${indent(type.values.map((v) => `${v}: ${this.getValueTS(v)}`).join(',\n'), TAB_SIZE)}
};

export type ${type.name} = (typeof ${type.name})[keyof typeof ${type.name}]\n`
  }

  private getValueTS(value: string): string {
    return this.isSymbolEnum() ? `Symbols.${value}` : `'${value}'`
  }
}
