import { assertNever } from '@prisma/internals'
import indent from 'indent-string'
import path from 'path'
import { ClientModelAction } from '../runtime/clientActions'

import type { DMMFHelper } from '../runtime/dmmf'
import { DMMF } from '../runtime/dmmf-types'

export enum Projection {
  select = 'select',
  include = 'include',
}

export function getScalarsName(modelName: string): string {
  return `${modelName}Scalars`
}

export function getPayloadName(modelName: string): string {
  return `${modelName}GetPayload`
}

// export function getExtractName(modelName: string, projection: Projection) {
//   return `Extract${modelName}${capitalize(projection)}`
// }

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
  return `${capitalize(modelName)}GroupByArgs`
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

export function getDefaultName(modelName: string): string {
  return `${modelName}Default`
}

export function getFieldArgName(field: DMMF.SchemaField, findMany = true): string {
  return getArgName((field.outputType.type as DMMF.OutputType).name, findMany && field.outputType.isList)
}

export function getArgName(name: string, findMany: boolean): string {
  if (!findMany) {
    return `${name}Args`
  }

  return `${name}FindManyArgs`
}

// we need names for all top level args,
// as GraphQL doesn't have the concept of unnamed args
export function getModelArgName(modelName: string, action?: ClientModelAction): string {
  if (!action) {
    return `${modelName}Args`
  }
  switch (action) {
    case DMMF.ModelAction.findMany:
      return `${modelName}FindManyArgs`
    case DMMF.ModelAction.findUnique:
      return `${modelName}FindUniqueArgs`
    case DMMF.ModelAction.findFirst:
      return `${modelName}FindFirstArgs`
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
      return `${modelName}GroupByArgs`
    case DMMF.ModelAction.aggregate:
      return getAggregateArgsName(modelName)
    case DMMF.ModelAction.count:
      return `${modelName}CountArgs`
    case DMMF.ModelAction.findRaw:
      return `${modelName}FindRawArgs`
    case DMMF.ModelAction.aggregateRaw:
      return `${modelName}AggregateRawArgs`
    case 'findFirstOrThrow':
      return `${modelName}FindFirstOrThrowArgs`
    case 'findUniqueOrThrow':
      return `${modelName}FindUniqueOrThrowArgs`
    default:
      assertNever(action, 'Unknown action')
  }
}

export function getDefaultArgName(dmmf: DMMFHelper, modelName: string, action: DMMF.ModelAction): string {
  const mapping = dmmf.mappings.modelOperations.find((m) => m.model === modelName)!

  const fieldName = mapping[action]
  const operation = getOperation(action)
  const queryType = operation === 'query' ? dmmf.queryType : dmmf.mutationType
  const field = queryType.fields.find((f) => f.name === fieldName)!
  return (field.args[0].inputTypes[0].type as DMMF.InputType).name
}

export function getOperation(action: DMMF.ModelAction): 'query' | 'mutation' {
  if (action === DMMF.ModelAction.findMany || action === DMMF.ModelAction.findUnique) {
    return 'query'
  }
  return 'mutation'
}

/**
 * Used to render the initial client args
 * @param modelName
 * @param fieldName
 * @param mapping
 */
export function renderInitialClientArgs( // TODO: dead code
  actionName: DMMF.ModelAction,
  fieldName: string,
  mapping: DMMF.ModelMapping,
): string {
  return `
  dmmf,
  fetcher,
  '${getOperation(actionName)}',
  '${fieldName}',
  '${mapping.plural}.${actionName}',
  args || {},
  [],
  errorFormat,
  measurePerformance\n`
}

export function getFieldTypeName(field: DMMF.SchemaField): string {
  if (typeof field.outputType.type === 'string') {
    return field.outputType.type
  }

  return field.outputType.type.name
}

export function getType(name: string, isList: boolean, isOptional?: boolean): string {
  return name + (isList ? '[]' : '') + (isOptional ? ' | null' : '')
}

export function getFieldType(field: DMMF.SchemaField): string {
  return getType(getFieldTypeName(field), field.outputType.isList)
}

interface SelectReturnTypeOptions {
  name: string
  actionName: ActionName
  renderPromise?: boolean
  hideCondition?: boolean
  isField?: boolean
  fieldName?: string
  projection: Projection
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
  isField = false, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SelectReturnTypeOptions): string {
  if (actionName === 'count') {
    return `Promise<number>`
  }
  if (actionName === 'aggregate') return `Promise<${getAggregateGetName(name)}<T>>`

  if (actionName === 'findRaw' || actionName === 'aggregateRaw') {
    return `PrismaPromise<JsonObject>`
  }

  const isList = actionName === DMMF.ModelAction.findMany

  if (actionName === 'deleteMany' || actionName === 'updateMany' || actionName === 'createMany') {
    return `PrismaPromise<BatchPayload>`
  }

  /**
   * Important: We handle findMany or isList special, as we don't want chaining from there
   */
  if (isList || hideCondition) {
    const listOpen = isList ? 'Array<' : ''
    const listClose = isList ? '>' : ''
    const promiseOpen = renderPromise ? 'PrismaPromise<' : ''
    const promiseClose = renderPromise ? '>' : ''

    return `CheckSelect<T, ${promiseOpen}${listOpen}${name}${listClose}${promiseClose}, ${promiseOpen}${listOpen}${getPayloadName(
      name,
    )}<T>${listClose}${promiseClose}>`
  }

  if (actionName === 'findFirstOrThrow' || actionName === 'findUniqueOrThrow') {
    return `CheckSelect<T, Prisma__${name}Client<${getType(name, isList)}>, Prisma__${name}Client<${getType(
      getPayloadName(name) + '<T>',
      isList,
    )}>>`
  }
  if (actionName === 'findFirst' || actionName === 'findUnique') {
    if (isField) {
      return `CheckSelect<T, Prisma__${name}Client<${getType(name, isList)} | null >, Prisma__${name}Client<${getType(
        getPayloadName(name) + '<T>',
        isList,
      )} | null >>`
    }
    return `HasReject<GlobalRejectSettings, LocalRejectSettings, '${actionName}', '${name}'> extends True ? CheckSelect<T, Prisma__${name}Client<${getType(
      name,
      isList,
    )}>, Prisma__${name}Client<${getType(
      getPayloadName(name) + '<T>',
      isList,
    )}>> : CheckSelect<T, Prisma__${name}Client<${getType(name, isList)} | null >, Prisma__${name}Client<${getType(
      getPayloadName(name) + '<T>',
      isList,
    )} | null >>`
  }
  return `CheckSelect<T, Prisma__${name}Client<${getType(name, isList)}>, Prisma__${name}Client<${getType(
    getPayloadName(name) + '<T>',
    isList,
  )}>>`
}

export function isQueryAction(action: DMMF.ModelAction, operation: 'query' | 'mutation'): boolean {
  if (!(action in DMMF.ModelAction)) {
    return false
  }
  const result = action === DMMF.ModelAction.findUnique || action === DMMF.ModelAction.findMany
  return operation === 'query' ? result : !result
}

export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1)
}

export function indentAllButFirstLine(str: string, indentation: number): string {
  const lines = str.split('\n')

  return lines[0] + '\n' + indent(lines.slice(1).join('\n'), indentation)
}

export function getRelativePathResolveStatement(outputDir: string, cwd?: string): string {
  if (!cwd) {
    return 'undefined'
  }
  return `path.resolve(__dirname, ${JSON.stringify(path.relative(outputDir, cwd))})`
}

function flatten(array): any[] {
  return Array.prototype.concat.apply([], array)
}

export function flatMap<T, U>(
  array: T[],
  callbackFn: (value: T, index: number, array: T[]) => U[],
  thisArg?: any,
): U[] {
  return flatten(array.map(callbackFn, thisArg))
}

/**
 * Returns unique elements of array
 * @param arr Array
 */

export function unique<T>(arr: T[]): T[] {
  const { length } = arr
  const result: T[] = []
  const seen = new Set() // just a cache

  loop: for (let i = 0; i < length; i++) {
    const value = arr[i]
    if (seen.has(value)) {
      continue loop
    }
    seen.add(value)
    result.push(value)
  }

  return result
}
