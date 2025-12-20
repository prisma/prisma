import { uncapitalize } from '@prisma/client-common'
import type * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'

import { DMMFHelper } from '../dmmf'
import { appendSkipType, extArgsParam, getFieldArgName, getIncludeName, getOmitName, getSelectName } from '../utils'
import { GenerateContext } from './GenerateContext'

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
    .namedType('runtime.Types.Extensions.GetOmit')
    .addGenericArgument(keysType)
    .addGenericArgument(modelResultExtensionsType(modelName))

  if (context.isPreviewFeatureOn('strictUndefinedChecks')) {
    omitType.addGenericArgument(ts.namedType('runtime.Types.Skip'))
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
    .namedType('runtime.Types.Extensions.GetSelect')
    .addGenericArgument(objectType)
    .addGenericArgument(modelResultExtensionsType(modelName))

  return buildExport(typeName, selectType)
}

function modelResultExtensionsType(modelName: string) {
  return extArgsParam.toArgument().subKey('result').subKey(uncapitalize(modelName))
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
      const subSelectType = ts.namedType(`Prisma.${getFieldArgName(field, modelName)}`)
      subSelectType.addGenericArgument(extArgsParam.toArgument())

      // Add whereUnique support for relations with compound unique constraints
      const whereUniqueType = getWhereUniqueTypeForField(field, modelName, context)
      if (whereUniqueType) {
        // Create an intersection type that adds whereUnique to the existing type
        const extendedType = ts
          .intersectionType([subSelectType, whereUniqueType])
        fieldType.addVariant(extendedType)
      } else {
        fieldType.addVariant(subSelectType)
      }
    }
    objectType.add(ts.property(field.name, appendSkipType(context, fieldType)).optional())
  }

  return objectType
}

/**
 * Returns a type for whereUnique if the relation target has compound unique constraints
 * that can be partially specified from the parent model
 */
function getWhereUniqueTypeForField(
  field: DMMF.SchemaField,
  parentModelName: string,
  context: GenerateContext,
): ts.TypeBuilder | null {
  const targetModelName = field.outputType.type
  const targetModel = context.dmmf.datamodel.models.find((m) => m.name === targetModelName)
  
  if (!targetModel) {
    return null
  }

  // Find the relation field in the target model that points back to the parent
  const relationField = targetModel.fields.find((f) => {
    if (f.kind !== 'object' || f.type !== parentModelName) {
      return false
    }
    // Check if this relation uses fields from a compound unique constraint
    return f.relationFromFields && f.relationFromFields.length > 0
  })

  if (!relationField || !relationField.relationFromFields || relationField.relationFromFields.length === 0) {
    return null
  }

  // Find compound unique constraints that include the relation fields
  const compoundUniques = targetModel.uniqueFields.filter((uniqueFields) => {
    // Check if all relationFromFields are part of this unique constraint
    const relationFieldsSet = new Set(relationField.relationFromFields!)
    return uniqueFields.some((uf) => relationFieldsSet.has(uf))
  })

  if (compoundUniques.length === 0) {
    return null
  }

  // Find the unique constraint that matches the relation fields
  const matchingUnique = compoundUniques.find((uniqueFields) => {
    const relationFieldsSet = new Set(relationField.relationFromFields!)
    // Check if relation fields are a subset of unique fields
    return relationField.relationFromFields!.every((rf) => uniqueFields.includes(rf))
  })

  if (!matchingUnique) {
    return null
  }

  // Get the remaining fields needed for the unique constraint
  const relationFieldsSet = new Set(relationField.relationFromFields!)
  const remainingFields = matchingUnique.filter((f) => !relationFieldsSet.has(f))

  if (remainingFields.length === 0) {
    // All fields are provided by the relation, so we can't use whereUnique
    return null
  }

  // Build a type that adds whereUnique property
  // The whereUnique will accept the target model's WhereUniqueInput
  const whereUniqueObjectType = ts.objectType()
  const whereUniqueInputType = ts.namedType(`Prisma.${targetModelName}WhereUniqueInput`)
  
  whereUniqueObjectType.add(
    ts
      .property('whereUnique', whereUniqueInputType)
      .optional()
      .setDocComment(
        ts.docComment(
          `Filter by a compound unique constraint. Returns at most one result (or null) instead of an array. Cannot be used together with \`where\`.`,
        ),
      ),
  )

  return whereUniqueObjectType
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
