import indent from 'indent-string'

import type { DMMFHelper } from '../../runtime/dmmf'
import type { DMMF } from '../../runtime/dmmf-types'
import { GraphQLScalarToJSTypeTable, isSchemaEnum, needsNamespace } from '../../runtime/utils/common'
import * as ts from '../ts-builders'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { wrapComment } from './helpers'

export function buildModelOutputProperty(field: DMMF.Field, dmmf: DMMFHelper, useNamespace = false) {
  let fieldTypeName = GraphQLScalarToJSTypeTable[field.type] || field.type
  if (Array.isArray(fieldTypeName)) {
    fieldTypeName = fieldTypeName[0]
  }
  if (useNamespace && needsNamespace(field.type, dmmf)) {
    fieldTypeName = `Prisma.${fieldTypeName}`
  }
  let fieldType: ts.TypeBuilder
  // object and not a composite
  if (field.kind === 'object' && !dmmf.typeMap[field.type]) {
    fieldType = ts.namedType(`${fieldTypeName}Payload`).addGenericArgument(ts.namedType('ExtArgs'))
  } else {
    fieldType = ts.namedType(fieldTypeName)
  }

  if (field.isList) {
    fieldType = ts.array(fieldType)
  } else if (!field.isRequired) {
    fieldType = ts.unionType(fieldType).addVariant(ts.nullType)
  }
  const property = ts.property(field.name, fieldType)
  if (field.documentation) {
    property.setDocComment(ts.docComment(field.documentation))
  }
  return property
}

export class OutputField implements Generatable {
  constructor(
    protected readonly dmmf: DMMFHelper,
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
    const nullableStr = field.isNullable && !field.outputType.isList ? ' | null' : ''
    const namespaceStr = useNamespace && needsNamespace(field.outputType.type, this.dmmf) ? `Prisma.` : ''
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
  constructor(protected readonly dmmf: DMMFHelper, protected readonly type: DMMF.OutputType) {
    this.name = type.name
    this.fields = type.fields
  }
  public toTS(): string {
    const { type } = this
    return `
export type ${type.name} = {
${indent(
  type.fields.map((field) => new OutputField(this.dmmf, { ...field, ...field.outputType }).toTS()).join('\n'),
  TAB_SIZE,
)}
}`
  }
}
