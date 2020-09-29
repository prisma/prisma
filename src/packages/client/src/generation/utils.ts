import indent from 'indent-string'
import path from 'path'
import { DMMFClass } from '../runtime/dmmf'
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

export function getAggregateInputType(aggregateOutputType: string): string {
  return aggregateOutputType.replace(/OutputType$/, 'InputType')
}

export function getAggregateArgsName(modelName: string): string {
  return `Aggregate${capitalize(modelName)}Args`
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

export function getFieldArgName(field: DMMF.SchemaField): string {
  return getArgName(
    (field.outputType.type as DMMF.OutputType).name,
    field.outputType.isList,
  )
}

export function getArgName(name: string, isList: boolean): string {
  if (!isList) {
    return `${name}Args`
  }

  return `FindMany${name}Args`
}

// we need names for all top level args,
// as GraphQL doesn't have the concept of unnamed args
export function getModelArgName(
  modelName: string,
  action?: DMMF.ModelAction,
): string {
  if (!action) {
    return `${modelName}Args`
  }
  switch (action) {
    case DMMF.ModelAction.findMany:
      return `FindMany${modelName}Args`
    case DMMF.ModelAction.findOne:
      return `FindOne${modelName}Args`
    case DMMF.ModelAction.findFirst:
      return `FindFirst${modelName}Args`
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
    case DMMF.ModelAction.deleteMany:
      return `${modelName}DeleteManyArgs`
  }
}

export function getDefaultArgName(
  dmmf: DMMFClass,
  modelName: string,
  action: DMMF.ModelAction,
): string {
  const mapping = dmmf.mappings.find((m) => m.model === modelName)!

  const fieldName = mapping[action]
  const operation = getOperation(action)
  const queryType = operation === 'query' ? dmmf.queryType : dmmf.mutationType
  const field = queryType.fields.find((f) => f.name === fieldName)!
  return (field.args[0].inputTypes[0].type as DMMF.InputType).name
}

export function getOperation(action: DMMF.ModelAction): 'query' | 'mutation' {
  if (
    action === DMMF.ModelAction.findMany ||
    action === DMMF.ModelAction.findOne
  ) {
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
export function renderInitialClientArgs(
  actionName: DMMF.ModelAction,
  fieldName: string,
  mapping: DMMF.Mapping,
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

export function getType(
  name: string,
  isList: boolean,
  isOptional?: boolean,
): string {
  return name + (isList ? '[]' : '') + (isOptional ? ' | null' : '')
}

export function getFieldType(field: DMMF.SchemaField): string {
  return getType(getFieldTypeName(field), field.outputType.isList)
}

interface SelectReturnTypeOptions {
  name: string
  actionName: DMMF.ModelAction
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
export function getSelectReturnType({
  name,
  actionName,
  renderPromise = true,
  hideCondition = false,
  isField = false, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SelectReturnTypeOptions): string {
  const isList = actionName === DMMF.ModelAction.findMany

  if (actionName === 'deleteMany' || actionName === 'updateMany') {
    return `Promise<BatchPayload>`
  }

  /**
   * Important: We handle findMany or isList special, as we don't want chaining from there
   */
  if (isList || hideCondition) {
    const listOpen = isList ? 'Array<' : ''
    const listClose = isList ? '>' : ''
    const promiseOpen = renderPromise ? 'Promise<' : ''
    const promiseClose = renderPromise ? '>' : ''

    return `CheckSelect<T, ${promiseOpen}${listOpen}${name}${listClose}${promiseClose}, ${promiseOpen}${listOpen}${getPayloadName(
      name,
    )}<T>${listClose}${promiseClose}>`
  }

  return `CheckSelect<T, Prisma__${name}Client<${getType(name, isList)}${actionName === 'findOne' ? ' | null' : ''
    }>, Prisma__${name}Client<${getType(getPayloadName(name) + '<T>', isList)}${actionName === 'findOne' ? ' | null' : ''
    }>>`
}

export function isQueryAction(
  action: DMMF.ModelAction,
  operation: 'query' | 'mutation',
): boolean {
  if (!(action in DMMF.ModelAction)) {
    return false
  }
  const result =
    action === DMMF.ModelAction.findOne || action === DMMF.ModelAction.findMany
  return operation === 'query' ? result : !result
}

export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1)
}

export function indentAllButFirstLine(
  str: string,
  indentation: number,
): string {
  const lines = str.split('\n')

  return lines[0] + '\n' + indent(lines.slice(1).join('\n'), indentation)
}

export function getRelativePathResolveStatement(
  outputDir: string,
  cwd?: string,
): string {
  if (!cwd) {
    return 'undefined'
  }
  return `path.resolve(__dirname, ${JSON.stringify(
    path.relative(outputDir, cwd),
  )})`
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
