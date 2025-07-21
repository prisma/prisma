import { capitalize } from '@prisma/client-common'
import * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'

import { GenerateContext } from './GenerateContext'
import { getMethodJSDocBody } from './jsdoc-helpers'
import { extArgsParam, getAggregateArgsName, getModelArgName } from './name-utils'
import { getReturnType } from './return-type'
import { TypeBuilders } from './type-builders'

export function buildModelDelegateMethod(modelName: string, actionName: DMMF.ModelAction, context: GenerateContext) {
  const mapping = context.dmmf.mappingsMap[modelName] ?? { model: modelName, plural: `${modelName}s` }
  const modelOrType = context.dmmf.typeAndModelMap[modelName]
  const dependencyValidators = getNonAggregateMethodDependencyValidations(mapping, actionName, context)

  const method = ts
    .method(actionName)
    .setDocComment(ts.docComment(getMethodJSDocBody(actionName, mapping, modelOrType)))
    .addParameter(getNonAggregateMethodArgs(context.tsx, modelName, actionName, dependencyValidators))
    .setReturnType(getReturnType({ modelName, actionName, tsx: context.tsx }))

  const generic = getNonAggregateMethodGenericParam(modelName, actionName)
  if (generic) {
    method.addGenericParameter(generic)
  }

  for (const validator of dependencyValidators) {
    method.addGenericParameter(validator)
  }

  return method
}

function getNonAggregateMethodArgs(
  tsx: TypeBuilders,
  modelName: string,
  actionName: DMMF.ModelAction,
  dependencyValidators: ts.GenericParameter[],
) {
  const makeParameter = (type: ts.TypeBuilder) => {
    if (dependencyValidators.length > 0) {
      type = ts.intersectionType([type, ...dependencyValidators.map((validator) => ts.namedType(validator.name))])
    }
    return ts.parameter('args', type)
  }

  if (actionName === DMMF.ModelAction.count) {
    const type = tsx.omit(
      ts.namedType(getModelArgName(modelName, DMMF.ModelAction.findMany)),
      ts
        .unionType(ts.stringLiteral('select'))
        .addVariant(ts.stringLiteral('include'))
        .addVariant(ts.stringLiteral('distinct')),
    )
    return makeParameter(type).optional()
  }
  if (actionName === DMMF.ModelAction.findRaw || actionName === DMMF.ModelAction.aggregateRaw) {
    return makeParameter(ts.namedType(`Prisma.${getModelArgName(modelName, actionName)}`)).optional()
  }

  const type = ts
    .namedType('Prisma.SelectSubset')
    .addGenericArgument(ts.namedType('T'))
    .addGenericArgument(
      ts.namedType(getModelArgName(modelName, actionName)).addGenericArgument(extArgsParam(tsx).toArgument()),
    )
  const param = makeParameter(type)

  if (
    actionName === DMMF.ModelAction.findMany ||
    actionName === DMMF.ModelAction.findFirst ||
    actionName === DMMF.ModelAction.deleteMany ||
    actionName === DMMF.ModelAction.createMany ||
    actionName === DMMF.ModelAction.createManyAndReturn ||
    actionName === DMMF.ModelAction.findFirstOrThrow
  ) {
    param.optional()
  }

  return param
}

function getNonAggregateMethodGenericParam(modelName: string, actionName: DMMF.ModelAction) {
  if (
    actionName === DMMF.ModelAction.count ||
    actionName === DMMF.ModelAction.findRaw ||
    actionName === DMMF.ModelAction.aggregateRaw
  ) {
    return null
  }
  const arg = ts.genericParameter('T')
  if (actionName === DMMF.ModelAction.aggregate) {
    return arg.extends(ts.namedType(getAggregateArgsName(modelName)))
  }
  return arg.extends(ts.namedType(getModelArgName(modelName, actionName)))
}

function getNonAggregateMethodDependencyValidations(
  modelMapping: DMMF.ModelMapping,
  actionName: DMMF.ModelAction,
  context: GenerateContext,
): ts.GenericParameter[] {
  const outputFieldName = modelMapping[actionName]
  if (!outputFieldName) {
    throw new Error(`Missing mapping for ${modelMapping.model}.${actionName}`)
  }

  const outputField =
    context.dmmf.outputTypeMap.prisma['Query'].fields.find((f) => f.name === outputFieldName) ??
    context.dmmf.outputTypeMap.prisma['Mutation'].fields.find((f) => f.name === outputFieldName)

  if (!outputField) {
    throw new Error(`Can't find output field ${outputFieldName} in the schema`)
  }

  const validators: ts.GenericParameter[] = []

  for (const args of outputField.args) {
    if (args.requiresOtherFields === undefined) {
      continue
    }

    const objectType = ts.objectType()

    for (const reqArg of args.requiresOtherFields) {
      objectType.add(ts.property(reqArg, ts.objectType()))
    }

    validators.push(
      ts
        .genericParameter(`${capitalize(args.name)}DependenciesValidator`)
        .extends(
          ts
            .conditionalType()
            .check(ts.stringLiteral(args.name))
            .extends(ts.namedType('Prisma.Keys<T>'))
            .then(objectType)
            .else(ts.objectType()),
        ),
    )
  }

  return validators
}
