import { Generatable } from './Generatable'
import indent from 'indent-string'
import { DMMFClass } from '../../runtime/dmmf'
import { BaseField, DMMF } from '../../runtime/dmmf-types'
import {
  GraphQLScalarToJSTypeTable,
  needsNamespace,
} from '../../runtime/utils/common'
import { ExportCollector } from './helpers'
import { TAB_SIZE } from './constants'

export class OutputField implements Generatable {
  constructor(
    protected readonly dmmf: DMMFClass,
    protected readonly field: BaseField,
    protected readonly useNamespace = false,
  ) {}
  public toTS(): string {
    const { field, useNamespace } = this
    // ENUMTODO
    let fieldType =
      typeof field.type === 'string'
        ? GraphQLScalarToJSTypeTable[field.type] || field.type
        : field.type[0].name
    if (Array.isArray(fieldType)) {
      fieldType = fieldType[0]
    }
    const arrayStr = field.isList ? `[]` : ''
    const nullableStr = !field.isRequired && !field.isList ? ' | null' : ''
    const namespaceStr =
      useNamespace && needsNamespace(field, this.dmmf) ? `Prisma.` : ''
    return `${field.name}: ${namespaceStr}${fieldType}${arrayStr}${nullableStr}`
  }
}

export class OutputType implements Generatable {
  public name: string
  public fields: DMMF.SchemaField[]
  constructor(
    protected readonly dmmf: DMMFClass,
    protected readonly type: DMMF.OutputType,
    protected readonly collector?: ExportCollector,
  ) {
    this.name = type.name
    this.fields = type.fields
    collector?.addSymbol(this.name)
  }
  public toTS(): string {
    const { type } = this
    return `
export type ${type.name} = {
${indent(
  type.fields
    .map((field) =>
      new OutputField(this.dmmf, { ...field, ...field.outputType }).toTS(),
    )
    .join('\n'),
  TAB_SIZE,
)}
}`
  }
}
