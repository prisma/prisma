import indent from 'indent-string'

import type { DMMF } from '../../runtime/dmmf-types'
import { objectEnumNames } from '../../runtime/object-enums'
import { strictEnumNames } from '../../runtime/strictEnum'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'

export class Enum implements Generatable {
  constructor(protected readonly type: DMMF.SchemaEnum, protected readonly useNamespace: boolean) {}

  private isObjectEnum(): boolean {
    return this.useNamespace && objectEnumNames.includes(this.type.name)
  }

  private isStrictEnum(): boolean {
    return this.useNamespace && strictEnumNames.includes(this.type.name)
  }

  public toJS(): string {
    const { type } = this
    const enumVariants = `{
${indent(type.values.map((v) => `${v}: ${this.getValueJS(v)}`).join(',\n'), TAB_SIZE)}
}`
    const enumBody = this.isStrictEnum() ? `makeStrictEnum(${enumVariants})` : enumVariants
    return `${this.useNamespace ? 'Prisma.' : ''}${type.name} = ${enumBody};`
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
