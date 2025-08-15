import { NonModelOperation, Operation, uncapitalize } from '@prisma/client-common'
import { assertNever } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'

import {
  extArgsParam,
  getAggregateName,
  getCountAggregateOutputName,
  getFieldRefsTypeName,
  getGroupByName,
  getModelArgName,
  getPayloadName,
} from '../utils'
import { GenerateContext } from './GenerateContext'
import { getModelActions } from './utils/getModelActions'
import * as tsx from './utils/type-builders'

export function clientTypeMapDefinition(context: GenerateContext) {
  const typeMap = `${ts.stringify(clientTypeMapModelsDefinition(context))} & ${clientTypeMapOthersDefinition(context)}`

  return `
export interface TypeMapCb<GlobalOmitOptions = {}> extends runtime.Types.Utils.Fn<{extArgs: runtime.Types.Extensions.InternalArgs }, runtime.Types.Utils.Record<string, any>> {
  returns: TypeMap<this['params']['extArgs'], GlobalOmitOptions>
}

export type TypeMap<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> = ${typeMap}`
}

function clientTypeMapModelsDefinition(context: GenerateContext) {
  const meta = ts.objectType()

  const modelNames = context.dmmf.datamodel.models.map((m) => m.name)

  // `modelNames` can be empty if `generate --allow-no-models` is used.
  if (modelNames.length === 0) {
    meta.add(ts.property('modelProps', ts.neverType))
  } else {
    meta.add(ts.property('modelProps', ts.unionType(modelNames.map((name) => ts.stringLiteral(uncapitalize(name))))))
  }

  const isolationLevel = context.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')
    ? ts.namedType('TransactionIsolationLevel')
    : ts.neverType
  meta.add(ts.property('txIsolationLevel', isolationLevel))

  const model = ts.objectType()

  model.addMultiple(
    modelNames.map((modelName) => {
      const entry = ts.objectType()
      entry.add(
        ts.property('payload', ts.namedType(getPayloadName(modelName)).addGenericArgument(extArgsParam.toArgument())),
      )
      entry.add(ts.property('fields', ts.namedType(`Prisma.${getFieldRefsTypeName(modelName)}`)))
      const actions = getModelActions(context.dmmf, modelName)
      const operations = ts.objectType()
      operations.addMultiple(
        actions.map((action) => {
          const operationType = ts.objectType()
          const argsType = `Prisma.${getModelArgName(modelName, action)}`
          operationType.add(ts.property('args', ts.namedType(argsType).addGenericArgument(extArgsParam.toArgument())))
          operationType.add(ts.property('result', clientTypeMapModelsResultDefinition(modelName, action)))
          return ts.property(action, operationType)
        }),
      )
      entry.add(ts.property('operations', operations))
      return ts.property(modelName, entry)
    }),
  )

  return ts
    .objectType()
    .add(ts.property('globalOmitOptions', ts.objectType().add(ts.property('omit', ts.namedType('GlobalOmitOptions')))))
    .add(ts.property('meta', meta))
    .add(ts.property('model', model))
}

function clientTypeMapOthersDefinition(context: GenerateContext) {
  const otherOperationsNames = context.dmmf.getOtherOperationNames().flatMap((name) => {
    const results = [`$${name}`]
    if (name === 'executeRaw' || name === 'queryRaw') {
      results.push(`$${name}Unsafe`)
    }

    if (name === 'queryRaw' && context.isPreviewFeatureOn('typedSql')) {
      results.push(`$queryRawTyped`)
    }

    return results
  })

  const argsResultMap = {
    $executeRaw: { args: '[query: TemplateStringsArray | Sql, ...values: any[]]', result: 'any' },
    $queryRaw: { args: '[query: TemplateStringsArray | Sql, ...values: any[]]', result: 'any' },
    $executeRawUnsafe: { args: '[query: string, ...values: any[]]', result: 'any' },
    $queryRawUnsafe: { args: '[query: string, ...values: any[]]', result: 'any' },
    $runCommandRaw: { args: 'Prisma.InputJsonObject', result: 'JsonObject' },
    $queryRawTyped: { args: 'runtime.UnknownTypedSql', result: 'JsonObject' },
  } satisfies Record<NonModelOperation, { args: string; result: string }>

  return `{
  other: {
    payload: any
    operations: {${otherOperationsNames.reduce((acc, action) => {
      return `${acc}
      ${action}: {
        args: ${argsResultMap[action].args},
        result: ${argsResultMap[action].result}
      }`
    }, '')}
    }
  }
}`
}

function clientTypeMapModelsResultDefinition(
  modelName: string,
  action: Exclude<Operation, `$${string}`>,
): ts.TypeBuilder {
  if (action === 'count')
    return ts.unionType([tsx.optional(ts.namedType(`Prisma.${getCountAggregateOutputName(modelName)}`)), ts.numberType])
  if (action === 'groupBy') return ts.array(tsx.optional(ts.namedType(`Prisma.${getGroupByName(modelName)}`)))
  if (action === 'aggregate') return tsx.optional(ts.namedType(`Prisma.${getAggregateName(modelName)}`))
  if (action === 'findRaw') return ts.namedType('Prisma.JsonObject')
  if (action === 'aggregateRaw') return ts.namedType('Prisma.JsonObject')
  if (action === 'deleteMany') return ts.namedType('BatchPayload')
  if (action === 'createMany') return ts.namedType('BatchPayload')
  if (action === 'createManyAndReturn') return ts.array(payloadToResult(modelName))
  if (action === 'updateMany') return ts.namedType('BatchPayload')
  if (action === 'updateManyAndReturn') return ts.array(payloadToResult(modelName))
  if (action === 'findMany') return ts.array(payloadToResult(modelName))
  if (action === 'findFirst') return ts.unionType([payloadToResult(modelName), ts.nullType])
  if (action === 'findUnique') return ts.unionType([payloadToResult(modelName), ts.nullType])
  if (action === 'findFirstOrThrow') return payloadToResult(modelName)
  if (action === 'findUniqueOrThrow') return payloadToResult(modelName)
  if (action === 'create') return payloadToResult(modelName)
  if (action === 'update') return payloadToResult(modelName)
  if (action === 'upsert') return payloadToResult(modelName)
  if (action === 'delete') return payloadToResult(modelName)

  assertNever(action, `Unknown action: ${action}`)
}

function payloadToResult(modelName: string) {
  return ts.namedType('runtime.Types.Utils.PayloadToResult').addGenericArgument(ts.namedType(getPayloadName(modelName)))
}
