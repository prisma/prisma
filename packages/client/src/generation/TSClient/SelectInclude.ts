import { DMMF } from '@prisma/generator-helper'

import { DMMFHelper } from '../dmmf'
import * as ts from '../ts-builders'
import { getFieldArgName, getIncludeName, getSelectName } from '../utils'
import { lowerCase } from '../utils/common'

type BuildIncludeTypeParams = {
  modelName: string
  dmmf: DMMFHelper
  fields: readonly DMMF.SchemaField[]
}

const extArgsParameter = ts
  .genericParameter('ExtArgs')
  .extends(ts.namedType('$Extensions.InternalArgs'))
  .default(ts.namedType('$Extensions.DefaultArgs'))

export function buildIncludeType({ modelName, dmmf, fields }: BuildIncludeTypeParams) {
  const type = buildSelectOrIncludeObject(modelName, getIncludeFields(fields, dmmf))
  return buildExport(getIncludeName(modelName), type)
}

type BuildSelectTypeParams = {
  modelName: string
  fields: readonly DMMF.SchemaField[]
}

export function buildSelectType({ modelName, fields }: BuildSelectTypeParams) {
  const objectType = buildSelectOrIncludeObject(modelName, fields)
  const selectType = ts
    .namedType('$Extensions.GetSelect')
    .addGenericArgument(objectType)
    .addGenericArgument(extArgsParameter.toArgument().subKey('result').subKey(lowerCase(modelName)))

  return buildExport(getSelectName(modelName), selectType)
}

export function buildScalarSelectType({ modelName, fields }: BuildSelectTypeParams) {
  const object = buildSelectOrIncludeObject(
    modelName,
    fields.filter((field) => field.outputType.location === 'scalar' || field.outputType.location === 'enumTypes'),
  )

  return ts.moduleExport(ts.typeDeclaration(`${getSelectName(modelName)}Scalar`, object))
}

function buildSelectOrIncludeObject(modelName: string, fields: readonly DMMF.SchemaField[]) {
  const objectType = ts.objectType()

  for (const field of fields) {
    const fieldType = ts.unionType<ts.PrimitiveType | ts.NamedType>(ts.booleanType)
    if (field.outputType.location === 'outputObjectTypes') {
      const subSelectType = ts.namedType(getFieldArgName(field, modelName))

      subSelectType.addGenericArgument(extArgsParameter.toArgument())

      fieldType.addVariant(subSelectType)
    }
    objectType.add(ts.property(field.name, fieldType).optional())
  }
  return objectType
}

function buildExport(typeName: string, type: ts.TypeBuilder) {
  const declaration = ts.typeDeclaration(typeName, type)
  return ts.moduleExport(declaration.addGenericParameter(extArgsParameter))
}

function getIncludeFields(fields: readonly DMMF.SchemaField[], dmmf: DMMFHelper) {
  return fields.filter((field) => {
    if (field.outputType.location !== 'outputObjectTypes') {
      return false
    }
    return !dmmf.isComposite(field.outputType.type)
  })
}
