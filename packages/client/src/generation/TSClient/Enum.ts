import indent from 'indent-string'

import { objectEnumNames } from '../../runtime/core/types/exported/ObjectEnums'
import { strictEnumNames } from '../../runtime/strictEnum'
import type { DMMF } from '../dmmf-types'
import { TAB_SIZE } from './constants'
import type { Generable } from './Generable'

export class Enum implements Generable {
  constructor(
    protected readonly type: DMMF.SchemaEnum,
    protected readonly useNamespace: boolean,
  ) {}

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

    return this.useNamespace
      ? `exports.Prisma.${type.name} = ${enumBody};`
      : `exports.${type.name} = exports.$Enums.${type.name} = ${enumBody};`
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
