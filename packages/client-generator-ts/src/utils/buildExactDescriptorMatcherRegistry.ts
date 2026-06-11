import type * as DMMF from '@prisma/dmmf'

type ExactDescriptorMatcherSpec = {
  model: string
  action: 'findUnique' | 'findMany'
  clientMethod: string
  field: string
  valueType: ExactDescriptorMatcherValueType
  select: string[]
}

type ExactDescriptorMatcherValueType = 'bigint' | 'boolean' | 'bytes' | 'date' | 'decimal' | 'number' | 'string'

type ExactDescriptorMatcherTemplateSpec = {
  model: string
  action: 'findUnique'
  clientMethod: string
  field: string
  valueType: ExactDescriptorMatcherTemplateValueType
  templateName: 'blogPagePostV1'
}

type ExactDescriptorMatcherTemplateValueType = Extract<ExactDescriptorMatcherValueType, 'number' | 'string'>

export function buildExactDescriptorMatcherRegistry(
  datamodel: DMMF.Datamodel,
  configValue: string | string[] | undefined,
  factoryExpression: string,
): string {
  const specs = parseExactDescriptorMatcherSpecs(datamodel, configValue)
  if (specs.flat.length === 0 && specs.templates.length === 0) {
    return ''
  }

  if (specs.templates.length === 0) {
    return `config.descriptorMatcherRegistry = ${factoryExpression}(${JSON.stringify(specs.flat, null, 2)})`
  }

  return buildTemplateDescriptorMatcherRegistry(specs.flat, specs.templates, factoryExpression)
}

function parseExactDescriptorMatcherSpecs(
  datamodel: DMMF.Datamodel,
  configValue: string | string[] | undefined,
): { flat: ExactDescriptorMatcherSpec[]; templates: ExactDescriptorMatcherTemplateSpec[] } {
  const specs: ExactDescriptorMatcherSpec[] = []
  const templates: ExactDescriptorMatcherTemplateSpec[] = []

  if (configValue === undefined) {
    return { flat: specs, templates }
  }

  const rawSpecs = Array.isArray(configValue) ? configValue : [configValue]
  for (const rawSpec of rawSpecs) {
    if (rawSpec.startsWith('template:')) {
      templates.push(parseExactDescriptorMatcherTemplateSpec(datamodel, rawSpec))
    } else {
      const spec = parseExactDescriptorMatcherSpec(datamodel, rawSpec)
      if (spec !== undefined) {
        specs.push(spec)
      }
    }
  }

  return { flat: specs, templates }
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
  if (action !== 'findUnique' && action !== 'findMany') {
    throw new Error(`Unsupported internalExactDescriptorHelpers action ${JSON.stringify(action)}`)
  }

  const dmmfModel = datamodel.models.find((candidate) => candidate.name === model)
  if (dmmfModel === undefined) {
    throw new Error(`Invalid internalExactDescriptorHelpers model ${JSON.stringify(model)}`)
  }

  const valueType = getExactMatcherValueType(dmmfModel, action, field)

  const select = selectCsv.split(',').filter((value) => value.length > 0)
  if (select.length === 0) {
    throw new Error(`Invalid internalExactDescriptorHelpers select list ${JSON.stringify(rawSpec)}`)
  }
  if (new Set(select).size !== select.length) {
    throw new Error(`Duplicate internalExactDescriptorHelpers select field in ${JSON.stringify(rawSpec)}`)
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

function getExactMatcherValueType(
  dmmfModel: DMMF.Model,
  action: 'findUnique' | 'findMany',
  field: string,
): ExactDescriptorMatcherValueType {
  if (action === 'findMany') {
    if (field !== 'take') {
      throw new Error(`internalExactDescriptorHelpers findMany field must be "take" ${JSON.stringify(field)}`)
    }

    return 'number'
  }

  const dmmfField = dmmfModel.fields.find((candidate) => candidate.name === field)
  if (dmmfField === undefined || dmmfField.kind !== 'scalar' || dmmfField.isList) {
    throw new Error(`Invalid internalExactDescriptorHelpers field ${JSON.stringify(`${dmmfModel.name}.${field}`)}`)
  }
  if (!dmmfField.isId && !dmmfField.isUnique) {
    throw new Error(
      `internalExactDescriptorHelpers findUnique field must be unique ${JSON.stringify(`${dmmfModel.name}.${field}`)}`,
    )
  }

  switch (dmmfField.type) {
    case 'BigInt':
      return 'bigint'
    case 'Boolean':
      return 'boolean'
    case 'Bytes':
      return 'bytes'
    case 'DateTime':
      return 'date'
    case 'Decimal':
      return 'decimal'
    case 'Int':
      return 'number'
    case 'String':
      return 'string'
    default:
      throw new Error(`Unsupported internalExactDescriptorHelpers field type ${JSON.stringify(dmmfField.type)}`)
  }
}

function parseExactDescriptorMatcherTemplateSpec(
  datamodel: DMMF.Datamodel,
  rawSpec: string,
): ExactDescriptorMatcherTemplateSpec {
  const [prefix, modelAction, field, templateName, ...rest] = rawSpec.split(':')
  if (
    prefix !== 'template' ||
    rest.length > 0 ||
    modelAction === undefined ||
    field === undefined ||
    templateName === undefined
  ) {
    throw new Error(`Invalid internalExactDescriptorHelpers entry ${JSON.stringify(rawSpec)}`)
  }

  const separator = modelAction.lastIndexOf('.')
  if (separator === -1) {
    throw new Error(`Invalid internalExactDescriptorHelpers entry ${JSON.stringify(rawSpec)}`)
  }

  const model = modelAction.slice(0, separator)
  const action = modelAction.slice(separator + 1)
  if (action !== 'findUnique') {
    throw new Error(`Unsupported internalExactDescriptorHelpers template action ${JSON.stringify(action)}`)
  }
  if (templateName !== 'blogPagePostV1') {
    throw new Error(`Unsupported internalExactDescriptorHelpers template ${JSON.stringify(templateName)}`)
  }

  const dmmfModel = datamodel.models.find((candidate) => candidate.name === model)
  if (dmmfModel === undefined) {
    throw new Error(`Invalid internalExactDescriptorHelpers model ${JSON.stringify(model)}`)
  }

  const valueType = getExactMatcherValueType(dmmfModel, action, field)
  if (valueType !== 'number' && valueType !== 'string') {
    throw new Error(
      `internalExactDescriptorHelpers template field must be an Int or String unique field ${JSON.stringify(field)}`,
    )
  }

  return {
    model,
    action,
    clientMethod: `${dmmfToJSModelName(model)}.${action}`,
    field,
    valueType,
    templateName,
  }
}

function dmmfToJSModelName(name: string): string {
  return name.replace(/^./, (str) => str.toLowerCase())
}

function buildTemplateDescriptorMatcherRegistry(
  flatSpecs: ExactDescriptorMatcherSpec[],
  templates: ExactDescriptorMatcherTemplateSpec[],
  factoryExpression: string,
): string {
  const templateCases = templates
    .map((template, index) => {
      return `    if (context.model === ${JSON.stringify(template.model)} && context.action === ${JSON.stringify(
        template.action,
      )} && context.clientMethod === ${JSON.stringify(template.clientMethod)}) {
      const matcher = __internalExactDescriptorBindBlogPagePostV1_${index}(context)
      if (matcher !== undefined) {
        return matcher
      }
    }`
    })
    .join('\n\n')

  const templateBinders = templates.map(buildBlogPagePostV1Template).join('\n')

  return `const __internalExactDescriptorFlatRegistry = ${factoryExpression}(${JSON.stringify(flatSpecs, null, 2)})
config.descriptorMatcherRegistry = {
  getMatcher(context) {
${templateCases}

    return __internalExactDescriptorFlatRegistry.getMatcher(context)
  },
}

${templateBinders}
${blogPagePostV1TemplateSupportCode}`
}

function buildBlogPagePostV1Template(template: ExactDescriptorMatcherTemplateSpec, index: number): string {
  const field = JSON.stringify(template.field)
  const valueType = JSON.stringify(template.valueType)
  const descriptorValueType = JSON.stringify(template.valueType === 'number' ? 'int32' : template.valueType)
  const valueMatches =
    template.valueType === 'number' ? '__internalExactDescriptorIsInt32(value)' : `typeof value === ${valueType}`

  return `function __internalExactDescriptorBindBlogPagePostV1_${index}(context) {
  const root = __internalExactDescriptorRoot(context)
  if (root === undefined || !__internalExactDescriptorHasKeysInOrder(root, ['where', 'select'])) {
    return undefined
  }

  const where = __internalExactDescriptorAsObject(root.fields.where)
  if (where === undefined || !__internalExactDescriptorHasKeysInOrder(where, [${field}])) {
    return undefined
  }

  const placeholder = __internalExactDescriptorAsPlaceholder(where.fields[${field}])
  const selectShape = __internalExactDescriptorBlogPagePostV1SelectShape(root.fields.select)
  if (placeholder === undefined || placeholder.valueType !== ${descriptorValueType} || selectShape === undefined) {
    return undefined
  }

  return (args) => __internalExactDescriptorMatchBlogPagePostV1_${index}(args, placeholder.name, selectShape)
}

function __internalExactDescriptorMatchBlogPagePostV1_${index}(args, valuePlaceholder, selectShape) {
  if (!__internalExactDescriptorIsRecord(args) || !__internalExactDescriptorKeys2(args, 'where', 'select')) {
    return undefined
  }

  const where = args.where
  if (!__internalExactDescriptorIsRecord(where) || !__internalExactDescriptorKeys1(where, ${field})) {
    return undefined
  }

  const value = where[${field}]
  if (!(${valueMatches}) || !__internalExactDescriptorMatchesBlogPagePostV1Select(args.select, selectShape)) {
    return undefined
  }

  return { [valuePlaceholder]: value }
}
`
}

const blogPagePostV1TemplateSupportCode = `const __internalExactDescriptorBlogPageRootScalarFields = [
  'id',
  'title',
  'slug',
  'content',
  'published',
  'viewCount',
  'createdAt',
]
const __internalExactDescriptorBlogPageRootSelectKeys = [
  'id',
  'title',
  'slug',
  'content',
  'published',
  'viewCount',
  'createdAt',
  'author',
  'category',
  'tags',
  'comments',
  '_count',
]
const __internalExactDescriptorBlogPageMinimalRootSelectKeys = [
  'id',
  'title',
  'author',
  'category',
  'tags',
  'comments',
  '_count',
]
const __internalExactDescriptorBlogPageUserSelectKeys = ['id', 'name', 'avatar']
const __internalExactDescriptorBlogPageSlugSelectKeys = ['id', 'name', 'slug']
const __internalExactDescriptorBlogPageCountSelectKeys = ['likes', 'comments']
const __internalExactDescriptorBlogPageCommentSelectKeys = ['id', 'content', 'createdAt', 'author']

function __internalExactDescriptorMatchesBlogPagePostV1Select(value, selectShape) {
  if (!__internalExactDescriptorIsRecord(value)) {
    return false
  }

  if (selectShape === 'full') {
    if (!__internalExactDescriptorKeys12(value)) {
      return false
    }

    for (let i = 0; i < __internalExactDescriptorBlogPageRootScalarFields.length; i++) {
      if (value[__internalExactDescriptorBlogPageRootScalarFields[i]] !== true) {
        return false
      }
    }
  } else if (
    !__internalExactDescriptorKeys7(value, 'id', 'title', 'author', 'category', 'tags', 'comments', '_count') ||
    value.id !== true ||
    value.title !== true
  ) {
    return false
  }

  return (
    __internalExactDescriptorMatchesSelectionWrapper(value.author, __internalExactDescriptorBlogPageUserSelectKeys) &&
    __internalExactDescriptorMatchesSelectionWrapper(value.category, __internalExactDescriptorBlogPageSlugSelectKeys) &&
    __internalExactDescriptorMatchesBlogPageTagsSelection(value.tags) &&
    __internalExactDescriptorMatchesBlogPageCommentsSelection(value.comments) &&
    __internalExactDescriptorMatchesSelectionWrapper(value._count, __internalExactDescriptorBlogPageCountSelectKeys)
  )
}

function __internalExactDescriptorMatchesBlogPageTagsSelection(value) {
  if (!__internalExactDescriptorIsRecord(value) || !__internalExactDescriptorKeys1(value, 'select')) {
    return false
  }

  const select = value.select
  if (!__internalExactDescriptorIsRecord(select) || !__internalExactDescriptorKeys1(select, 'tag')) {
    return false
  }

  return __internalExactDescriptorMatchesSelectionWrapper(select.tag, __internalExactDescriptorBlogPageSlugSelectKeys)
}

function __internalExactDescriptorMatchesBlogPageCommentsSelection(value) {
  if (
    !__internalExactDescriptorIsRecord(value) ||
    !__internalExactDescriptorKeys3(value, 'take', 'orderBy', 'select') ||
    value.take !== 10
  ) {
    return false
  }

  const orderBy = value.orderBy
  if (!Array.isArray(orderBy) || orderBy.length !== 1) {
    return false
  }

  const firstOrderBy = orderBy[0]
  if (
    !__internalExactDescriptorIsRecord(firstOrderBy) ||
    !__internalExactDescriptorKeys1(firstOrderBy, 'createdAt') ||
    firstOrderBy.createdAt !== 'desc'
  ) {
    return false
  }

  const select = value.select
  return (
    __internalExactDescriptorIsRecord(select) &&
    __internalExactDescriptorKeys4(select, 'id', 'content', 'createdAt', 'author') &&
    select.id === true &&
    select.content === true &&
    select.createdAt === true &&
    __internalExactDescriptorMatchesSelectionWrapper(select.author, __internalExactDescriptorBlogPageUserSelectKeys)
  )
}

function __internalExactDescriptorMatchesSelectionWrapper(value, keys) {
  if (!__internalExactDescriptorIsRecord(value) || !__internalExactDescriptorKeys1(value, 'select')) {
    return false
  }

  const select = value.select
  if (!__internalExactDescriptorIsRecord(select) || !__internalExactDescriptorHasExactKeys(select, keys)) {
    return false
  }

  for (let i = 0; i < keys.length; i++) {
    if (select[keys[i]] !== true) {
      return false
    }
  }

  return true
}

function __internalExactDescriptorBlogPagePostV1SelectShape(value) {
  const select = __internalExactDescriptorAsObject(value)
  if (select === undefined) {
    return undefined
  }

  let selectShape
  if (__internalExactDescriptorHasKeysInOrder(select, __internalExactDescriptorBlogPageRootSelectKeys)) {
    for (let i = 0; i < __internalExactDescriptorBlogPageRootScalarFields.length; i++) {
      if (!__internalExactDescriptorIsConstant(select.fields[__internalExactDescriptorBlogPageRootScalarFields[i]], true)) {
        return undefined
      }
    }
    selectShape = 'full'
  } else if (__internalExactDescriptorHasKeysInOrder(select, __internalExactDescriptorBlogPageMinimalRootSelectKeys)) {
    if (
      !__internalExactDescriptorIsConstant(select.fields.id, true) ||
      !__internalExactDescriptorIsConstant(select.fields.title, true)
    ) {
      return undefined
    }
    selectShape = 'minimal'
  } else {
    return undefined
  }

  return __internalExactDescriptorSelectionWrapperDescriptor(
    select.fields.author,
    __internalExactDescriptorBlogPageUserSelectKeys,
  ) &&
    __internalExactDescriptorSelectionWrapperDescriptor(
      select.fields.category,
      __internalExactDescriptorBlogPageSlugSelectKeys,
    ) &&
    __internalExactDescriptorBlogPageTagsSelectionDescriptor(select.fields.tags) &&
    __internalExactDescriptorBlogPageCommentsSelectionDescriptor(select.fields.comments) &&
    __internalExactDescriptorSelectionWrapperDescriptor(
      select.fields._count,
      __internalExactDescriptorBlogPageCountSelectKeys,
    )
    ? selectShape
    : undefined
}

function __internalExactDescriptorBlogPageTagsSelectionDescriptor(value) {
  const root = __internalExactDescriptorAsObject(value)
  if (root === undefined || !__internalExactDescriptorHasKeysInOrder(root, ['select'])) {
    return false
  }

  const select = __internalExactDescriptorAsObject(root.fields.select)
  return (
    select !== undefined &&
    __internalExactDescriptorHasKeysInOrder(select, ['tag']) &&
    __internalExactDescriptorSelectionWrapperDescriptor(
      select.fields.tag,
      __internalExactDescriptorBlogPageSlugSelectKeys,
    )
  )
}

function __internalExactDescriptorBlogPageCommentsSelectionDescriptor(value) {
  const root = __internalExactDescriptorAsObject(value)
  if (
    root === undefined ||
    !__internalExactDescriptorHasKeysInOrder(root, ['take', 'orderBy', 'select']) ||
    !__internalExactDescriptorIsConstant(root.fields.take, 10)
  ) {
    return false
  }

  const orderBy = __internalExactDescriptorAsArray(root.fields.orderBy)
  if (orderBy === undefined || orderBy.items.length !== 1) {
    return false
  }

  const firstOrderBy = __internalExactDescriptorAsObject(orderBy.items[0])
  if (
    firstOrderBy === undefined ||
    !__internalExactDescriptorHasKeysInOrder(firstOrderBy, ['createdAt']) ||
    !__internalExactDescriptorIsConstant(firstOrderBy.fields.createdAt, 'desc')
  ) {
    return false
  }

  const select = __internalExactDescriptorAsObject(root.fields.select)
  return (
    select !== undefined &&
    __internalExactDescriptorHasKeysInOrder(select, __internalExactDescriptorBlogPageCommentSelectKeys) &&
    __internalExactDescriptorIsConstant(select.fields.id, true) &&
    __internalExactDescriptorIsConstant(select.fields.content, true) &&
    __internalExactDescriptorIsConstant(select.fields.createdAt, true) &&
    __internalExactDescriptorSelectionWrapperDescriptor(
      select.fields.author,
      __internalExactDescriptorBlogPageUserSelectKeys,
    )
  )
}

function __internalExactDescriptorSelectionWrapperDescriptor(value, keys) {
  const root = __internalExactDescriptorAsObject(value)
  if (root === undefined || !__internalExactDescriptorHasKeysInOrder(root, ['select'])) {
    return false
  }

  const select = __internalExactDescriptorAsObject(root.fields.select)
  if (select === undefined || !__internalExactDescriptorHasKeysInOrder(select, keys)) {
    return false
  }

  for (let i = 0; i < keys.length; i++) {
    if (!__internalExactDescriptorIsConstant(select.fields[keys[i]], true)) {
      return false
    }
  }

  return true
}

function __internalExactDescriptorRoot(context) {
  if (!__internalExactDescriptorIsRecord(context.descriptor)) {
    return undefined
  }

  return __internalExactDescriptorAsObject(context.descriptor.root)
}

function __internalExactDescriptorAsObject(value) {
  if (
    __internalExactDescriptorIsRecord(value) &&
    value.kind === 'object' &&
    Array.isArray(value.keys) &&
    __internalExactDescriptorIsRecord(value.fields)
  ) {
    return value
  }

  return undefined
}

function __internalExactDescriptorAsPlaceholder(value) {
  if (
    __internalExactDescriptorIsRecord(value) &&
    value.kind === 'placeholder' &&
    typeof value.name === 'string' &&
    typeof value.valueType === 'string'
  ) {
    return value
  }

  return undefined
}

function __internalExactDescriptorAsArray(value) {
  if (__internalExactDescriptorIsRecord(value) && value.kind === 'array' && Array.isArray(value.items)) {
    return value
  }

  return undefined
}

function __internalExactDescriptorIsConstant(value, expected) {
  return __internalExactDescriptorIsRecord(value) && value.kind === 'constant' && Object.is(value.value, expected)
}

function __internalExactDescriptorHasKeysInOrder(descriptor, expectedKeys) {
  if (descriptor.keys.length !== expectedKeys.length) {
    return false
  }

  for (let i = 0; i < expectedKeys.length; i++) {
    const key = expectedKeys[i]
    if (descriptor.keys[i] !== key || !Object.hasOwn(descriptor.fields, key)) {
      return false
    }
  }

  return true
}

function __internalExactDescriptorHasExactKeys(value, expectedKeys) {
  const keys = Object.keys(value)
  if (keys.length !== expectedKeys.length) {
    return false
  }

  for (let i = 0; i < expectedKeys.length; i++) {
    if (keys[i] !== expectedKeys[i]) {
      return false
    }
  }

  return true
}

function __internalExactDescriptorKeys1(value, key0) {
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === key0
}

function __internalExactDescriptorKeys2(value, key0, key1) {
  const keys = Object.keys(value)
  return keys.length === 2 && keys[0] === key0 && keys[1] === key1
}

function __internalExactDescriptorKeys3(value, key0, key1, key2) {
  const keys = Object.keys(value)
  return keys.length === 3 && keys[0] === key0 && keys[1] === key1 && keys[2] === key2
}

function __internalExactDescriptorKeys4(value, key0, key1, key2, key3) {
  const keys = Object.keys(value)
  return keys.length === 4 && keys[0] === key0 && keys[1] === key1 && keys[2] === key2 && keys[3] === key3
}

function __internalExactDescriptorKeys7(value, key0, key1, key2, key3, key4, key5, key6) {
  const keys = Object.keys(value)
  return (
    keys.length === 7 &&
    keys[0] === key0 &&
    keys[1] === key1 &&
    keys[2] === key2 &&
    keys[3] === key3 &&
    keys[4] === key4 &&
    keys[5] === key5 &&
    keys[6] === key6
  )
}

function __internalExactDescriptorKeys12(value) {
  const keys = Object.keys(value)
  return (
    keys.length === 12 &&
    keys[0] === 'id' &&
    keys[1] === 'title' &&
    keys[2] === 'slug' &&
    keys[3] === 'content' &&
    keys[4] === 'published' &&
    keys[5] === 'viewCount' &&
    keys[6] === 'createdAt' &&
    keys[7] === 'author' &&
    keys[8] === 'category' &&
    keys[9] === 'tags' &&
    keys[10] === 'comments' &&
    keys[11] === '_count'
  )
}

function __internalExactDescriptorIsInt32(value) {
  return typeof value === 'number' && Number.isInteger(value) && -(2 ** 31) <= value && value <= 2 ** 31 - 1
}

function __internalExactDescriptorIsRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}`
