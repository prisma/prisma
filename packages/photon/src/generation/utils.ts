import indent from 'indent-string'
import path from 'path'
import { DMMFClass } from '../runtime/dmmf'
import { DMMF } from '../runtime/dmmf-types'

export enum Projection {
  select = 'select',
  include = 'include',
}

export function getScalarsName(modelName: string) {
  return `${modelName}Scalars`
}

export function getPayloadName(modelName: string, projection: Projection) {
  return `${modelName}Get${capitalize(projection)}Payload`
}

// export function getExtractName(modelName: string, projection: Projection) {
//   return `Extract${modelName}${capitalize(projection)}`
// }

export function getSelectName(modelName: string) {
  return `${modelName}Select`
}

export function getIncludeName(modelName: string) {
  return `${modelName}Include`
}

export function getDefaultName(modelName: string) {
  return `${modelName}Default`
}

export function getFieldArgName(field: DMMF.SchemaField, projection?: Projection): string {
  return getArgName((field.outputType.type as DMMF.OutputType).name, field.outputType.isList, projection)
}

export function getArgName(name: string, isList: boolean, projection?: Projection): string {
  const projectionString = projection ? capitalize(projection) : ''
  if (!isList) {
    return `${name}${projectionString}Args`
  }

  return `FindMany${name}${projectionString}Args`
}

// we need names for all top level args,
// as GraphQL doesn't have the concept of unnamed args
export function getModelArgName(modelName: string, projection?: Projection, action?: DMMF.ModelAction): string {
  const projectionName = projection ? capitalize(projection) : ''
  if (!action) {
    return `${modelName}${projectionName}Args`
  }
  switch (action) {
    case DMMF.ModelAction.findMany:
      return `FindMany${modelName}${projectionName}Args`
    case DMMF.ModelAction.findOne:
      return `FindOne${modelName}${projectionName}Args`
    case DMMF.ModelAction.upsert:
      return `${modelName}${projectionName}UpsertArgs`
    case DMMF.ModelAction.update:
      return `${modelName}${projectionName}UpdateArgs`
    case DMMF.ModelAction.updateMany:
      return `${modelName}${projectionName}UpdateManyArgs`
    case DMMF.ModelAction.delete:
      return `${modelName}${projectionName}DeleteArgs`
    case DMMF.ModelAction.create:
      return `${modelName}${projectionName}CreateArgs`
    case DMMF.ModelAction.deleteMany:
      return `${modelName}${projectionName}DeleteManyArgs`
  }
}

export function getDefaultArgName(dmmf: DMMFClass, modelName: string, action: DMMF.ModelAction) {
  const mapping = dmmf.mappings.find(m => m.model === modelName)!

  const fieldName = mapping[action]
  const operation = getOperation(action)
  const queryType = operation === 'query' ? dmmf.queryType : dmmf.mutationType
  const field = queryType.fields.find(f => f.name === fieldName)!
  return (field.args[0].inputType[0].type as DMMF.InputType).name
}

export function getOperation(action: DMMF.ModelAction): 'query' | 'mutation' {
  if (action === DMMF.ModelAction.findMany || action === DMMF.ModelAction.findOne) {
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
  '${getOperation(actionName as DMMF.ModelAction)}',
  '${fieldName}',
  '${mapping.plural}.${actionName}',
  args,
  []\n`
}

export function getFieldTypeName(field: DMMF.SchemaField) {
  if (typeof field.outputType.type === 'string') {
    return field.outputType.type
  }

  return field.outputType.type.name
}

export function getType(name: string, isList: boolean) {
  return name + (isList ? '[]' : '')
}

export function getFieldType(field: DMMF.SchemaField) {
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
  isField = false,
  fieldName,
}: SelectReturnTypeOptions) {
  const isList = actionName === DMMF.ModelAction.findMany

  const selectArgName = isField
    ? getArgName(name, isList, Projection.select)
    : getModelArgName(name, Projection.select, actionName as DMMF.ModelAction)

  const includeArgName = isField
    ? getArgName(name, isList, Projection.include)
    : getModelArgName(name, Projection.include, actionName as DMMF.ModelAction)

  const requiredArgName = getModelArgName(name, undefined, actionName as DMMF.ModelAction) + 'Required'
  const requiredCheck = `T extends ${requiredArgName} ? 'Please either choose \`select\` or \`include\`' : `
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
    const renderType = (projection: Projection) =>
      `${promiseOpen}${listOpen}${getPayloadName(name, projection)}<Extract${getModelArgName(
        name,
        projection,
        actionName,
      )}<T>>${listClose}${promiseClose}`

    return `${requiredCheck}T extends ${selectArgName}
? ${renderType(Projection.select)} : T extends ${includeArgName}
? ${renderType(Projection.include)} : ${promiseOpen}${listOpen}${name}${promiseClose}${listClose}`
  }

  const selectType = `${renderPromise ? 'Promise<' : ''}${getPayloadName(
    name,
    Projection.select,
  )}<Extract${selectArgName}<T>>${renderPromise ? '>' : ''}`

  const includeType = `${renderPromise ? 'Promise<' : ''}${getPayloadName(
    name,
    Projection.include,
  )}<Extract${includeArgName}<T>>${renderPromise ? '>' : ''}`

  return `${requiredCheck}T extends ${selectArgName} ? ${selectType}
: T extends ${includeArgName} ? ${includeType} : ${name}Client<${getType(name, isList)}>`
}

export function isQueryAction(action: DMMF.ModelAction, operation: 'query' | 'mutation'): boolean {
  if (!(action in DMMF.ModelAction)) {
    return false
  }
  const result = action === DMMF.ModelAction.findOne || action === DMMF.ModelAction.findMany
  return operation === 'query' ? result : !result
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1)
}

export function indentAllButFirstLine(str: string, indentation: number) {
  const lines = str.split('\n')

  return lines[0] + '\n' + indent(lines.slice(1).join('\n'), indentation)
}

export function getRelativePathResolveStatement(outputDir: string, cwd?: string) {
  if (!cwd) {
    return 'undefined'
  }
  return `path.resolve(__dirname, ${JSON.stringify(path.relative(outputDir, cwd))})`
}
