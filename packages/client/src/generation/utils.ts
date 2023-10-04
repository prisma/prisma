import { assertNever } from '@prisma/internals'

import { DMMF } from './dmmf-types'
import * as ts from './ts-builders'

export function getSelectName(modelName: string): string {
  return `${modelName}Select`
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

export function getIncludeName(modelName: string): string {
  return `${modelName}Include`
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

export function getLegacyModelArgName(modelName: string) {
  return `${modelName}Args`
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
    case DMMF.ModelAction.delete:
      return `${modelName}DeleteArgs`
    case DMMF.ModelAction.create:
      return `${modelName}CreateArgs`
    case DMMF.ModelAction.createMany:
      return `${modelName}CreateManyArgs`
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
      assertNever(action, 'Unknown action')
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

interface SelectReturnTypeOptions {
  name: string
  actionName: DMMF.ModelAction
  renderPromise?: boolean
  hideCondition?: boolean
  isChaining?: boolean
  fieldName?: string
  isNullable?: boolean
}

/**
 * Get the complicated extract output
 * @param name Model name
 * @param actionName action name
 */
export function getReturnType({
  name,
  actionName,
  renderPromise = true,
  hideCondition = false,
  isChaining = false,
  isNullable = false,
}: SelectReturnTypeOptions): string {
  if (actionName === 'count') {
    return `Promise<number>`
  }
  if (actionName === 'aggregate') return `Promise<${getAggregateGetName(name)}<T>>`

  if (actionName === 'findRaw' || actionName === 'aggregateRaw') {
    return `Prisma.PrismaPromise<JsonObject>`
  }

  const isList = actionName === DMMF.ModelAction.findMany

  if (actionName === 'deleteMany' || actionName === 'updateMany' || actionName === 'createMany') {
    return `Prisma.PrismaPromise<BatchPayload>`
  }

  /**
   * Important: We handle findMany or isList special, as we don't want chaining from there
   */
  if (isList || hideCondition) {
    const promiseOpen = renderPromise ? 'Prisma.PrismaPromise<' : ''
    const promiseClose = renderPromise ? '>' : ''

    return `${promiseOpen}$Result.GetResult<${getPayloadName(name)}<ExtArgs>, T, '${actionName}'>${
      isChaining ? ' | Null' : ''
    }${promiseClose}`
  }

  if (isChaining && actionName === 'findUniqueOrThrow') {
    return `Prisma__${name}Client<${getType(
      `$Result.GetResult<${getPayloadName(name)}<ExtArgs>, T, '${actionName}'>`,
      isList,
    )} | ${isNullable ? 'null' : 'Null'}, ${isNullable ? 'null' : 'Null'}, ExtArgs>`
  }

  if (actionName === 'findFirstOrThrow' || actionName === 'findUniqueOrThrow') {
    return `Prisma__${name}Client<${getType(
      `$Result.GetResult<${getPayloadName(name)}<ExtArgs>, T, '${actionName}'>`,
      isList,
    )}, never, ExtArgs>`
  }

  if (actionName === 'findFirst' || actionName === 'findUnique') {
    return `Prisma__${name}Client<${getType(
      `$Result.GetResult<${getPayloadName(name)}<ExtArgs>, T, '${actionName}'>`,
      isList,
    )} | null, null, ExtArgs>`
  }

  return `Prisma__${name}Client<${getType(
    `$Result.GetResult<${getPayloadName(name)}<ExtArgs>, T, '${actionName}'>`,
    isList,
  )}, never, ExtArgs>`
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

export const extArgsParam = ts
  .genericParameter('ExtArgs')
  .extends(ts.namedType('$Extensions.InternalArgs'))
  .default(ts.namedType('$Extensions.DefaultArgs'))
