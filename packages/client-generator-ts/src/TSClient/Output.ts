import type * as DMMF from '@prisma/dmmf'
import { hasOwnProperty } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'

import type { DMMFHelper } from '../dmmf'
import { getPayloadName } from '../utils'
import { GraphQLScalarToJSTypeTable, needsNamespace } from '../utils/common'

export function buildModelOutputProperty(field: DMMF.Field, dmmf: DMMFHelper) {
  let fieldTypeName = hasOwnProperty(GraphQLScalarToJSTypeTable, field.type)
    ? GraphQLScalarToJSTypeTable[field.type]
    : field.type
  if (Array.isArray(fieldTypeName)) {
    fieldTypeName = fieldTypeName[0]
  }

  if (needsNamespace(field)) {
    fieldTypeName = `Prisma.${fieldTypeName}`
  }
  let fieldType: ts.TypeBuilder
  if (field.kind === 'object') {
    const payloadType = ts.namedType(getPayloadName(field.type))
    if (!dmmf.isComposite(field.type)) {
      payloadType.addGenericArgument(ts.namedType('ExtArgs'))
    }
    fieldType = payloadType
  } else if (field.kind === 'enum') {
    fieldType = ts.namedType(`$Enums.${fieldTypeName}`)
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

export function buildOutputType(type: DMMF.OutputType) {
  return ts.moduleExport(ts.typeDeclaration(type.name, ts.objectType().addMultiple(type.fields.map(buildOutputField))))
}

function buildOutputField(field: DMMF.SchemaField) {
  let fieldType: ts.TypeBuilder

  if (field.outputType.location === 'enumTypes' && field.outputType.namespace === 'model') {
    fieldType = ts.namedType(enumTypeName(field.outputType))
  } else {
    const typeNames = GraphQLScalarToJSTypeTable[field.outputType.type] ?? field.outputType.type
    fieldType = Array.isArray(typeNames) ? ts.namedType(typeNames[0]) : ts.namedType(typeNames)
  }

  if (field.outputType.isList) {
    fieldType = ts.array(fieldType)
  } else if (field.isNullable) {
    fieldType = ts.unionType(fieldType).addVariant(ts.nullType)
  }

  const property = ts.property(field.name, fieldType)
  if (field.deprecation) {
    property.setDocComment(
      ts.docComment(`@deprecated since ${field.deprecation.sinceVersion} because ${field.deprecation.reason}`),
    )
  }

  return property
}

function enumTypeName(ref: DMMF.OutputTypeRef) {
  const name = ref.type
  const namespace = ref.namespace === 'model' ? '$Enums' : 'Prisma'
  return `${namespace}.${name}`
}
