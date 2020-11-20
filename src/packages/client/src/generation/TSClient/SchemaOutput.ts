import indent from 'indent-string'
import { DMMF } from '../../runtime/dmmf-types'

import {
  GraphQLScalarToJSTypeTable,
} from '../../runtime/utils/common'
import { TAB_SIZE } from './constants'
import { Generatable } from './Generatable'
import { ExportCollector } from './helpers'

export class SchemaOutputField implements Generatable {
  constructor(protected readonly field: DMMF.SchemaField) { }
  public toTS(): string {
    const { field } = this
    let fieldType =
      typeof field.outputType.type === 'string'
        ? GraphQLScalarToJSTypeTable[field.outputType.type] ||
        field.outputType.type
        : field.outputType.type.name
    if (Array.isArray(fieldType)) {
      fieldType = fieldType[0]
    }
    const arrayStr = field.outputType.isList ? `[]` : ''
    const nullableStr =
      !field.isRequired && !field.outputType.isList ? ' | null' : ''
    return `${field.name}: ${fieldType}${arrayStr}${nullableStr}`
  }
}

export class SchemaOutputType implements Generatable {
  public name: string
  public fields: DMMF.SchemaField[]
  constructor(
    protected readonly type: DMMF.OutputType,
    protected readonly collector?: ExportCollector
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
          new SchemaOutputField({ ...field, ...field.outputType }).toTS(),
        )
        .join('\n'),
      TAB_SIZE,
    )}
}`
  }
}
