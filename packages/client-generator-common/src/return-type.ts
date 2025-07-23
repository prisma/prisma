import * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'

import { extArgsParam, getAggregateGetName, getFluentWrapperName, getPayloadName } from './name-utils'
import { TypeBuilders } from './type-builders'

type GetReturnTypeOptions = {
  tsx: TypeBuilders
  modelName: string
  actionName: DMMF.ModelAction
  isChaining?: boolean
  isNullable?: boolean
}

/**
 * Get the complicated extract output
 * @param name Model name
 * @param actionName action name
 */
export function getReturnType({
  tsx,
  modelName,
  actionName,
  isChaining = false,
  isNullable = false,
}: GetReturnTypeOptions): ts.TypeBuilder {
  if (actionName === DMMF.ModelAction.count) {
    return tsx.promise(ts.numberType)
  }
  if (actionName === DMMF.ModelAction.aggregate) {
    return tsx.promise(ts.namedType(getAggregateGetName(modelName)).addGenericArgument(ts.namedType('T')))
  }

  if (actionName === DMMF.ModelAction.findRaw || actionName === DMMF.ModelAction.aggregateRaw) {
    return tsx.prismaPromise(tsx.prismaType('JsonObject'))
  }

  if (
    actionName === DMMF.ModelAction.deleteMany ||
    actionName === DMMF.ModelAction.updateMany ||
    actionName === DMMF.ModelAction.createMany
  ) {
    return tsx.prismaPromise(tsx.prismaType('BatchPayload'))
  }

  const isList =
    actionName === DMMF.ModelAction.findMany ||
    actionName === DMMF.ModelAction.createManyAndReturn ||
    actionName === DMMF.ModelAction.updateManyAndReturn

  /**
   * Important: We handle findMany or isList special, as we don't want chaining from there
   */
  if (isList) {
    let result: ts.TypeBuilder = getResultType(tsx, modelName, actionName)
    if (isChaining) {
      result = ts.unionType(result).addVariant(ts.namedType('Null'))
    }

    return tsx.prismaPromise(result)
  }

  if (isChaining && actionName === DMMF.ModelAction.findUniqueOrThrow) {
    const nullType = isNullable ? ts.nullType : ts.namedType('Null')
    const result = ts.unionType<ts.TypeBuilder>(getResultType(tsx, modelName, actionName)).addVariant(nullType)
    return getFluentWrapper(tsx, modelName, result, nullType)
  }

  if (actionName === DMMF.ModelAction.findFirst || actionName === DMMF.ModelAction.findUnique) {
    const result = ts.unionType<ts.TypeBuilder>(getResultType(tsx, modelName, actionName)).addVariant(ts.nullType)
    return getFluentWrapper(tsx, modelName, result, ts.nullType)
  }

  return getFluentWrapper(tsx, modelName, getResultType(tsx, modelName, actionName))
}

function getFluentWrapper(
  tsx: TypeBuilders,
  modelName: string,
  resultType: ts.TypeBuilder,
  nullType: ts.TypeBuilder = ts.neverType,
) {
  return tsx
    .prismaType(getFluentWrapperName(modelName))
    .addGenericArgument(resultType)
    .addGenericArgument(nullType)
    .addGenericArgument(extArgsParam(tsx).toArgument())
    .addGenericArgument(ts.namedType('GlobalOmitOptions'))
}

function getResultType(tsx: TypeBuilders, modelName: string, actionName: DMMF.ModelAction) {
  return tsx
    .importedResultType('GetResult')
    .addGenericArgument(ts.namedType(getPayloadName(modelName)).addGenericArgument(extArgsParam(tsx).toArgument()))
    .addGenericArgument(ts.namedType('T'))
    .addGenericArgument(ts.stringLiteral(actionName))
    .addGenericArgument(ts.namedType('GlobalOmitOptions'))
}
