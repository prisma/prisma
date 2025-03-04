import type { DMMF } from '@prisma/generator-helper'

import type { DMMFHelper } from '../dmmf'
import * as ts from '../ts-builders'
import { appendSkipType, extArgsParam, getFieldArgName, getIncludeName, getOmitName, getSelectName } from '../utils'
import { lowerCase } from '../utils/common'
import type { GenerateContext } from './GenerateContext'

type BuildIncludeTypeParams = {
  typeName?: string
  modelName: string
  context: GenerateContext
  fields: readonly DMMF.SchemaField[]
}

export function buildIncludeType({
  modelName,
  typeName = getIncludeName(modelName),
  context,
  fields,
}: BuildIncludeTypeParams) {
  const type = buildSelectOrIncludeObject(modelName, getIncludeFields(fields, context.dmmf), context)
  return buildExport(typeName, type)
}

type BuildOmitTypeParams = {
  modelName: string
  context: GenerateContext
  fields: readonly DMMF.SchemaField[]
}

export function buildOmitType({ modelName, fields, context }: BuildOmitTypeParams) {
  const keysType = ts.unionType<ts.TypeBuilder>(
    fields
      .filter(
        (field) =>
          field.outputType.location === 'scalar' ||
          field.outputType.location === 'enumTypes' ||
          context.dmmf.isComposite(field.outputType.type),
      )
      .map((field) => ts.stringLiteral(field.name)),
  )

  const omitType = ts
    .namedType('$Extensions.GetOmit')
    .addGenericArgument(keysType)
    .addGenericArgument(modelResultExtensionsType(modelName))

  if (context.isPreviewFeatureOn('strictUndefinedChecks')) {
    omitType.addGenericArgument(ts.namedType('$Types.Skip'))
  }

  return buildExport(getOmitName(modelName), omitType)
}

type BuildSelectTypeParams = {
  modelName: string
  fields: readonly DMMF.SchemaField[]
  context: GenerateContext
  typeName?: string
}

export function buildSelectType({
  modelName,
  typeName = getSelectName(modelName),
  fields,
  context,
}: BuildSelectTypeParams) {
  const objectType = buildSelectOrIncludeObject(modelName, fields, context)
  const selectType = ts
    .namedType('$Extensions.GetSelect')
    .addGenericArgument(objectType)
    .addGenericArgument(modelResultExtensionsType(modelName))

  return buildExport(typeName, selectType)
}

function modelResultExtensionsType(modelName: string) {
  return extArgsParam.toArgument().subKey('result').subKey(lowerCase(modelName))
}

export function buildScalarSelectType({ modelName, fields, context }: BuildSelectTypeParams) {
  const object = buildSelectOrIncludeObject(
    modelName,
    fields.filter((field) => field.outputType.location === 'scalar' || field.outputType.location === 'enumTypes'),
    context,
  )

  return ts.moduleExport(ts.typeDeclaration(`${getSelectName(modelName)}Scalar`, object))
}

function buildSelectOrIncludeObject(modelName: string, fields: readonly DMMF.SchemaField[], context: GenerateContext) {
  const objectType = ts.objectType()

  for (const field of fields) {
    const fieldType = ts.unionType<ts.PrimitiveType | ts.NamedType>(ts.booleanType)
    if (field.outputType.location === 'outputObjectTypes') {
      const subSelectType = ts.namedType(getFieldArgName(field, modelName))
      subSelectType.addGenericArgument(extArgsParam.toArgument())

      fieldType.addVariant(subSelectType)
    }
    objectType.add(ts.property(field.name, appendSkipType(context, fieldType)).optional())
  }

  return objectType
}

function buildExport(typeName: string, type: ts.TypeBuilder) {
  const declaration = ts.typeDeclaration(typeName, type)
  return ts.moduleExport(declaration.addGenericParameter(extArgsParam))
}

function getIncludeFields(fields: readonly DMMF.SchemaField[], dmmf: DMMFHelper) {
  return fields.filter((field) => {
    if (field.outputType.location !== 'outputObjectTypes') {
      return false
    }
    return !dmmf.isComposite(field.outputType.type)
  })
}
