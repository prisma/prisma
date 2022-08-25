import indent from 'indent-string'

import type { DMMF } from '../../runtime/dmmf-types'
import { GraphQLScalarToJSTypeTable } from '../../runtime/utils/common'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'

export class SchemaOutputField implements Generatable {
  constructor(protected readonly field: DMMF.SchemaField) {}
  public toTS(): string {
    const { field } = this
    let fieldType =
      typeof field.outputType.type === 'string'
        ? GraphQLScalarToJSTypeTable[field.outputType.type] || field.outputType.type
        : field.outputType.type.name
    if (Array.isArray(fieldType)) {
      fieldType = fieldType[0]
    }
    const arrayStr = field.outputType.isList ? `[]` : ''
    const nullableStr = field.isNullable ? ' | null' : ''
    return `${field.name}: ${fieldType}${arrayStr}${nullableStr}`
  }
}

export class SchemaOutputType implements Generatable {
  public name: string
  public fields: DMMF.SchemaField[]
  constructor(protected readonly type: DMMF.OutputType) {
    this.name = type.name
    this.fields = type.fields
  }
  public toTS(): string {
    const { type } = this
    return `
export type ${type.name} = {
${indent(
  type.fields.map((field) => new SchemaOutputField({ ...field, ...field.outputType }).toTS()).join('\n'),
  TAB_SIZE,
)}
}`
  }
}
