import { assertNever } from '@prisma/internals'

import { DMMF } from './dmmf-types'
import * as ts from './ts-builders'
import type { GenerateContext } from './TSClient/GenerateContext'

export function getSelectName(modelName: string): string {
  return `${modelName}Select`
}

export function getSelectCreateManyAndReturnName(modelName: string): string {
  return `${modelName}SelectCreateManyAndReturn`
}

export function getSelectUpdateManyAndReturnName(modelName: string): string {
  return `${modelName}SelectUpdateManyAndReturn`
}

export function getIncludeName(modelName: string): string {
  return `${modelName}Include`
}

export function getIncludeCreateManyAndReturnName(modelName: string): string {
  return `${modelName}IncludeCreateManyAndReturn`
}

export function getIncludeUpdateManyAndReturnName(modelName: string): string {
  return `${modelName}IncludeUpdateManyAndReturn`
}

export function getCreateManyAndReturnOutputType(modelName: string): string {
  return `CreateMany${modelName}AndReturnOutputType`
}

export function getUpdateManyAndReturnOutputType(modelName: string): string {
  return `UpdateMany${modelName}AndReturnOutputType`
}

export function getOmitName(modelName: string): string {
  return `${modelName}Omit`
}

export function getAggregateName(modelName: string): string {
  return `Aggregate${capitalize(modelName)}`
}

export function getGroupByName(modelName: string): string {
  return `${capitalize(modelName)}GroupByOutputType`
}

export function getAvgAggregateName(modelName: string): string {
  return `${capitalize(modelName)}AvgAggregateOutputType`
}

export function getSumAggregateName(modelName: string): string {
  return `${capitalize(modelName)}SumAggregateOutputType`
}

export function getMinAggregateName(modelName: string): string {
  return `${capitalize(modelName)}MinAggregateOutputType`
}

export function getMaxAggregateName(modelName: string): string {
  return `${capitalize(modelName)}MaxAggregateOutputType`
}

export function getCountAggregateInputName(modelName: string): string {
  return `${capitalize(modelName)}CountAggregateInputType`
}

export function getCountAggregateOutputName(modelName: string): string {
  return `${capitalize(modelName)}CountAggregateOutputType`
}

export function getAggregateInputType(aggregateOutputType: string): string {
  return aggregateOutputType.replace(/OutputType$/, 'InputType')
}

export function getGroupByArgsName(modelName: string): string {
  return `${modelName}GroupByArgs`
}

export function getGroupByPayloadName(modelName: string): string {
  return `Get${capitalize(modelName)}GroupByPayload`
}

export function getAggregateArgsName(modelName: string): string {
  return `${capitalize(modelName)}AggregateArgs`
}

export function getAggregateGetName(modelName: string): string {
  return `Get${capitalize(modelName)}AggregateType`
}

export function getAggregateScalarGetName(modelName: string): string {
  return `Get${capitalize(modelName)}AggregateScalarType`
}

export function getFieldArgName(field: DMMF.SchemaField, modelName: string): string {
  if (field.args.length) {
    return getModelFieldArgsName(field, modelName)
  }
  return getModelArgName(field.outputType.type)
}

export function getModelFieldArgsName(field: DMMF.SchemaField, modelName: string) {
  // Example: User$postsArgs
  // So it doesn't conflict with the generated type, like UserPostsArgs
  return `${modelName}$${field.name}Args`
}

// we need names for all top level args,
// as GraphQL doesn't have the concept of unnamed args
export function getModelArgName(modelName: string, action?: DMMF.ModelAction): string {
  if (!action) {
    return `${modelName}DefaultArgs`
  }
  switch (action) {
    case DMMF.ModelAction.findMany:
      return `${modelName}FindManyArgs`
    case DMMF.ModelAction.findUnique:
      return `${modelName}FindUniqueArgs`
    case DMMF.ModelAction.findUniqueOrThrow:
      return `${modelName}FindUniqueOrThrowArgs`
    case DMMF.ModelAction.findFirst:
      return `${modelName}FindFirstArgs`
    case DMMF.ModelAction.findFirstOrThrow:
      return `${modelName}FindFirstOrThrowArgs`
    case DMMF.ModelAction.upsert:
      return `${modelName}UpsertArgs`
    case DMMF.ModelAction.update:
      return `${modelName}UpdateArgs`
    case DMMF.ModelAction.updateMany:
      return `${modelName}UpdateManyArgs`
    case DMMF.ModelAction.updateManyAndReturn:
      return `${modelName}UpdateManyAndReturnArgs`
    case DMMF.ModelAction.delete:
      return `${modelName}DeleteArgs`
    case DMMF.ModelAction.create:
      return `${modelName}CreateArgs`
    case DMMF.ModelAction.createMany:
      return `${modelName}CreateManyArgs`
    case DMMF.ModelAction.createManyAndReturn:
      return `${modelName}CreateManyAndReturnArgs`
    case DMMF.ModelAction.deleteMany:
      return `${modelName}DeleteManyArgs`
    case DMMF.ModelAction.groupBy:
      return getGroupByArgsName(modelName)
    case DMMF.ModelAction.aggregate:
      return getAggregateArgsName(modelName)
    case DMMF.ModelAction.count:
      return `${modelName}CountArgs`
    case DMMF.ModelAction.findRaw:
      return `${modelName}FindRawArgs`
    case DMMF.ModelAction.aggregateRaw:
      return `${modelName}AggregateRawArgs`
    default:
      assertNever(action, `Unknown action: ${action}`)
  }
}

export function getPayloadName(modelName, namespace = true) {
  if (namespace) {
    return `Prisma.${getPayloadName(modelName, false)}`
  }
  return `$${modelName}Payload`
}

export function getFieldRefsTypeName(name: string) {
  return `${name}FieldRefs`
}

export function getType(name: string, isList: boolean, isOptional?: boolean): string {
  return name + (isList ? '[]' : '') + (isOptional ? ' | null' : '')
}

export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1)
}

export function getRefAllowedTypeName(type: DMMF.OutputTypeRef) {
  let typeName = type.type
  if (type.isList) {
    typeName += '[]'
  }

  return `'${typeName}'`
}

export function appendSkipType(context: GenerateContext, type: ts.TypeBuilder) {
  if (context.isPreviewFeatureOn('strictUndefinedChecks')) {
    return ts.unionType([type, ts.namedType('$Types.Skip')])
  }
  return type
}

export const extArgsParam = ts
  .genericParameter('ExtArgs')
  .extends(ts.namedType('$Extensions.InternalArgs'))
  .default(ts.namedType('$Extensions.DefaultArgs'))
