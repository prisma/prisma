import indent from 'indent-string'

import type { DMMF } from '../../runtime/dmmf-types'
import { objectEnumNames } from '../../runtime/object-enums'
import { strictEnumNames } from '../../runtime/strictEnum'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import type { ExportCollector } from './helpers'

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

  private isObjectEnum(): boolean {
    return this.useNamespace && objectEnumNames.includes(this.type.name)
  }

  private isStrictEnum(): boolean {
    return this.useNamespace && strictEnumNames.includes(this.type.name)
  }

  public toJS(): string {
    const { type } = this
    const factoryFunction = this.isStrictEnum() ? 'makeStrictEnum' : 'makeEnum'
    return `exports.${this.useNamespace ? 'Prisma.' : ''}${type.name} = ${factoryFunction}({
${indent(type.values.map((v) => `${v}: ${this.getValueJS(v)}`).join(',\n'), TAB_SIZE)}
});`
  }

  private getValueJS(value: string): string {
    return this.isObjectEnum() ? `Prisma.${value}` : `'${value}'`
  }

  public toTS(): string {
    const { type } = this

    return `export const ${type.name}: {
${indent(type.values.map((v) => `${v}: ${this.getValueTS(v)}`).join(',\n'), TAB_SIZE)}
};

export type ${type.name} = (typeof ${type.name})[keyof typeof ${type.name}]\n`
  }

  private getValueTS(value: string): string {
    return this.isObjectEnum() ? `typeof ${value}` : `'${value}'`
  }
}
