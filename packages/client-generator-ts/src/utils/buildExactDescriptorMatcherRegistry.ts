import type * as DMMF from '@prisma/dmmf'

type ExactDescriptorMatcherSpec = {
  model: string
  action: 'findUnique'
  clientMethod: string
  field: string
  valueType: 'number' | 'string'
  select: string[]
}

export function buildExactDescriptorMatcherRegistry(
  datamodel: DMMF.Datamodel,
  configValue: string | string[] | undefined,
  factoryExpression: string,
): string {
  const specs = parseExactDescriptorMatcherSpecs(datamodel, configValue)
  if (specs.length === 0) {
    return ''
  }

  return `config.descriptorMatcherRegistry = ${factoryExpression}(${JSON.stringify(specs, null, 2)})`
}

function parseExactDescriptorMatcherSpecs(
  datamodel: DMMF.Datamodel,
  configValue: string | string[] | undefined,
): ExactDescriptorMatcherSpec[] {
  if (configValue === undefined) {
    return []
  }

  const rawSpecs = Array.isArray(configValue) ? configValue : [configValue]
  const specs: ExactDescriptorMatcherSpec[] = []
  for (const rawSpec of rawSpecs) {
    const spec = parseExactDescriptorMatcherSpec(datamodel, rawSpec)
    if (spec !== undefined) {
      specs.push(spec)
    }
  }

  return specs
}

function parseExactDescriptorMatcherSpec(
  datamodel: DMMF.Datamodel,
  rawSpec: string,
): ExactDescriptorMatcherSpec | undefined {
  const [modelAction, field, selectCsv, ...rest] = rawSpec.split(':')
  if (rest.length > 0 || modelAction === undefined || field === undefined || selectCsv === undefined) {
    throw new Error(`Invalid internalExactDescriptorHelpers entry ${JSON.stringify(rawSpec)}`)
  }

  const separator = modelAction.lastIndexOf('.')
  if (separator === -1) {
    throw new Error(`Invalid internalExactDescriptorHelpers entry ${JSON.stringify(rawSpec)}`)
  }

  const model = modelAction.slice(0, separator)
  const action = modelAction.slice(separator + 1)
  if (action !== 'findUnique') {
    throw new Error(`Unsupported internalExactDescriptorHelpers action ${JSON.stringify(action)}`)
  }

  const dmmfModel = datamodel.models.find((candidate) => candidate.name === model)
  const dmmfField = dmmfModel?.fields.find((candidate) => candidate.name === field)
  if (dmmfModel === undefined || dmmfField === undefined || dmmfField.kind !== 'scalar' || dmmfField.isList) {
    throw new Error(`Invalid internalExactDescriptorHelpers field ${JSON.stringify(`${model}.${field}`)}`)
  }
  if (!dmmfField.isId && !dmmfField.isUnique) {
    throw new Error(
      `internalExactDescriptorHelpers findUnique field must be unique ${JSON.stringify(`${model}.${field}`)}`,
    )
  }

  const valueType = getExactMatcherValueType(dmmfField)
  if (valueType === undefined) {
    throw new Error(`Unsupported internalExactDescriptorHelpers field type ${JSON.stringify(dmmfField.type)}`)
  }

  const select = selectCsv.split(',').filter((value) => value.length > 0)
  if (select.length === 0) {
    throw new Error(`Invalid internalExactDescriptorHelpers select list ${JSON.stringify(rawSpec)}`)
  }
  for (const selectFieldName of select) {
    const selectField = dmmfModel.fields.find((candidate) => candidate.name === selectFieldName)
    if (selectField === undefined || selectField.kind !== 'scalar' || selectField.isList) {
      throw new Error(
        `Invalid internalExactDescriptorHelpers select field ${JSON.stringify(`${model}.${selectFieldName}`)}`,
      )
    }
  }

  return {
    model,
    action,
    clientMethod: `${dmmfToJSModelName(model)}.${action}`,
    field,
    valueType,
    select,
  }
}

function getExactMatcherValueType(field: DMMF.Field): 'number' | 'string' | undefined {
  switch (field.type) {
    case 'Int':
      return 'number'
    case 'String':
      return 'string'
    default:
      return undefined
  }
}

function dmmfToJSModelName(name: string): string {
  return name.replace(/^./, (str) => str.toLowerCase())
}
