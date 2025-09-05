import { objectEnumNames, strictEnumNames } from '@prisma/client-common'
import type * as DMMF from '@prisma/dmmf'
import indent from 'indent-string'

import { TAB_SIZE } from './constants'

export class Enum {
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

  public toTS(): string {
    const { type } = this

    const enumVariants = `{
${indent(type.values.map((v) => `${v}: ${this.getValue(v)}`).join(',\n'), TAB_SIZE)}
} as const`
    const enumBody = this.isStrictEnum() ? `runtime.makeStrictEnum(${enumVariants})` : enumVariants

    return `export const ${type.name} = ${enumBody}

export type ${type.name} = (typeof ${type.name})[keyof typeof ${type.name}]\n`
  }

  private getValue(value: string): string {
    return this.isObjectEnum() ? value : `'${value}'`
  }
}
