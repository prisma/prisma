import indent from 'indent-string'
import { DMMFClass } from '../../runtime/dmmf'
import { BaseField, DMMF } from '../../runtime/dmmf-types'
import {
  GraphQLScalarToJSTypeTable,
  isSchemaEnum,
  needsNamespace,
} from '../../runtime/utils/common'
import { TAB_SIZE } from './constants'
import { Generatable } from './Generatable'
import { ExportCollector, wrapComment } from './helpers'

export class ModelOutputField implements Generatable {
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

export class OutputField implements Generatable {
  constructor(
    protected readonly dmmf: DMMFClass,
    protected readonly field: DMMF.SchemaField,
    protected readonly useNamespace = false,
  ) {}
  public toTS(): string {
    const { field, useNamespace } = this
    // ENUMTODO
    let fieldType

    if (field.outputType.location === 'scalar') {
      fieldType = GraphQLScalarToJSTypeTable[field.outputType.type as string]
    } else if (field.outputType.location === 'enumTypes') {
      if (isSchemaEnum(field.outputType.type)) {
        fieldType = field.outputType.type.name
      }
    } else {
      fieldType = (field.outputType.type as DMMF.OutputType).name
    }

    if (Array.isArray(fieldType)) {
      fieldType = fieldType[0]
    }

    const arrayStr = field.outputType.isList ? `[]` : ''
    const nullableStr =
      field.isNullable && !field.outputType.isList ? ' | null' : ''
    const namespaceStr =
      useNamespace &&
      needsNamespace(
        {
          name: field.name,
          type: field.outputType.type,
          isList: field.outputType.isList,
          isRequired: !field.isNullable,
        },
        this.dmmf,
      )
        ? `Prisma.`
        : ''
    const deprecated = field.deprecation
      ? `@deprecated since ${field.deprecation.sinceVersion} because ${field.deprecation.reason}`
      : ''
    const jsdoc = deprecated ? wrapComment(deprecated) + '\n' : ''
    return `${jsdoc}${field.name}: ${namespaceStr}${fieldType}${arrayStr}${nullableStr}`
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
