import { RuntimeDataModel, RuntimeModel, uncapitalize } from '@prisma/client-common'
import { isObjectEnumValue } from '@prisma/client-runtime-utils'
import { assertNever } from '@prisma/internals'

import { ErrorFormat } from '../../getPrismaClient'
import { CallSite } from '../../utils/CallSite'
import { isDate, isValidDate } from '../../utils/date'
import { isDecimalJsLike } from '../../utils/decimalJsLike'
import {
  JsonArgumentValue,
  JsonFieldSelection,
  JsonQuery,
  JsonQueryAction,
  JsonSelectionSet,
  OutputTypeDescription,
  RawTaggedValue,
} from '../engines'
import { throwValidationException } from '../errorRendering/throwValidationException'
import { MergedExtensionsList } from '../extensions/MergedExtensionsList'
import { computeEngineSideOmissions, computeEngineSideSelection } from '../extensions/resultUtils'
import { isFieldRef } from '../model/FieldRef'
import { isParam } from '../model/Param'
import { isSkip, Skip } from '../types'
import {
  Action,
  JsArgs,
  JsInputValue,
  JsonConvertible,
  Omission,
  RawParameters,
  Selection,
} from '../types/exported/JsApi'
import { ValidationError } from '../types/ValidationError'

const jsActionToProtocolAction: Record<Action, JsonQueryAction> = {
  findUnique: 'findUnique',
  findUniqueOrThrow: 'findUniqueOrThrow',
  findFirst: 'findFirst',
  findFirstOrThrow: 'findFirstOrThrow',
  findMany: 'findMany',
  count: 'aggregate',
  create: 'createOne',
  createMany: 'createMany',
  createManyAndReturn: 'createManyAndReturn',
  update: 'updateOne',
  updateMany: 'updateMany',
  updateManyAndReturn: 'updateManyAndReturn',
  upsert: 'upsertOne',
  delete: 'deleteOne',
  deleteMany: 'deleteMany',
  executeRaw: 'executeRaw',
  queryRaw: 'queryRaw',
  aggregate: 'aggregate',
  groupBy: 'groupBy',
  runCommandRaw: 'runCommandRaw',
  findRaw: 'findRaw',
  aggregateRaw: 'aggregateRaw',
}

export type GlobalOmitOptions = {
  [modelName: string]: {
    [fieldName: string]: boolean
  }
}

export type SerializeParams = {
  runtimeDataModel: RuntimeDataModel
  modelName?: string
  action: Action
  args?: JsArgs
  extensions?: MergedExtensionsList
  callsite?: CallSite
  clientMethod: string
  clientVersion: string
  errorFormat: ErrorFormat
  previewFeatures: string[]
  globalOmit?: GlobalOmitOptions
  wrapRawValues?: boolean
}

const STRICT_UNDEFINED_ERROR_MESSAGE = 'explicitly `undefined` values are not allowed'
const EMPTY_ARGS: JsArgs = {}

export function serializeJsonQuery({
  modelName,
  action,
  args,
  runtimeDataModel,
  extensions = MergedExtensionsList.empty(),
  callsite,
  clientMethod,
  errorFormat,
  clientVersion,
  previewFeatures,
  globalOmit,
  wrapRawValues,
}: SerializeParams): JsonQuery {
  const context = new SerializeContext({
    runtimeDataModel,
    modelName,
    action,
    rootArgs: args,
    callsite,
    extensions,
    originalMethod: clientMethod,
    errorFormat,
    clientVersion,
    previewFeatures,
    globalOmit,
    wrapRawValues,
  })
  return {
    modelName,
    action: jsActionToProtocolAction[action],
    query: serializeFieldSelection(args, context),
  }
}

function serializeFieldSelection(args: JsArgs = EMPTY_ARGS, context: SerializeContext): JsonFieldSelection {
  const select = args.select
  const include = args.include
  const omit = args.omit
  let argumentArgs: JsArgs | undefined
  const keys = Object.keys(args)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key === 'select' || key === 'include' || key === 'omit') {
      continue
    }

    argumentArgs ??= {}
    argumentArgs[key] = args[key]
  }

  if (argumentArgs === undefined) {
    return {
      selection: serializeSelectionSet(select, include, omit, context),
    }
  }

  const serializedArguments = serializeArgumentsObject(argumentArgs, context)
  if (serializedArguments.$type === 'Raw' || Object.keys(serializedArguments).length > 0) {
    return {
      arguments: serializedArguments,
      selection: serializeSelectionSet(select, include, omit, context),
    }
  }

  return {
    selection: serializeSelectionSet(select, include, omit, context),
  }
}

function serializeSelectionSet(
  select: Selection | undefined,
  include: Selection | undefined,
  omit: Omission | undefined,
  context: SerializeContext,
): JsonSelectionSet {
  if (select) {
    if (include) {
      context.throwValidationError({
        kind: 'MutuallyExclusiveFields',
        firstField: 'include',
        secondField: 'select',
        selectionPath: context.getSelectionPath(),
      })
    } else if (omit) {
      context.throwValidationError({
        kind: 'MutuallyExclusiveFields',
        firstField: 'omit',
        secondField: 'select',
        selectionPath: context.getSelectionPath(),
      })
    }
    return createExplicitSelection(select, context)
  }

  return createImplicitSelection(context, include, omit)
}

function createImplicitSelection(
  context: SerializeContext,
  include: Selection | undefined,
  omit: Omission | undefined,
) {
  const selectionSet: JsonSelectionSet = {}

  if (context.modelOrType && !context.isRawAction()) {
    selectionSet.$composites = true
    selectionSet.$scalars = true
  }

  if (include) {
    addIncludedRelations(selectionSet, include, context)
  }

  omitFields(selectionSet, omit, context)

  return selectionSet
}

function addIncludedRelations(selectionSet: JsonSelectionSet, include: Selection, context: SerializeContext) {
  const keys = Object.keys(include)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = include[key]
    if (isSkip(value)) {
      continue
    }
    if (value === undefined) {
      validateSelectionForUndefined(value, context.nestSelection(key))
      selectionSet[key] = false
      continue
    }
    if (value === false) {
      selectionSet[key] = false
      continue
    }

    const field = context.findField(key)
    if (field && field.kind !== 'object') {
      context.throwValidationError({
        kind: 'IncludeOnScalar',
        selectionPath: context.getSelectionPath().concat(key),
        outputType: context.getOutputTypeDescription(),
      })
    }
    if (field) {
      const nestedContext = context.nestSelection(key)
      selectionSet[key] = serializeFieldSelection(value === true ? {} : value, nestedContext)
      continue
    }

    if (value === true) {
      selectionSet[key] = true
      continue
    }

    // value is an object, field is unknown
    // this can either be user error (in that case, qe will respond with an error)
    // or virtual field not present on datamodel (like `_count`).
    // Since we don't know which one cast is, we still attempt to serialize selection
    const nestedContext = context.nestSelection(key)
    selectionSet[key] = serializeFieldSelection(value, nestedContext)
  }
}

function omitFields(selectionSet: JsonSelectionSet, localOmit: Omission | undefined, context: SerializeContext) {
  const computedFields = context.getComputedFields()
  const combinedOmits = { ...context.getGlobalOmit(), ...localOmit }
  const omitWithComputedFields = computeEngineSideOmissions(combinedOmits, computedFields)
  const keys = Object.keys(omitWithComputedFields)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = omitWithComputedFields[key]
    if (isSkip(value)) {
      continue
    }
    validateSelectionForUndefined(value, context.nestSelection(key))
    const field = context.findField(key)
    if (computedFields?.[key] && !field) {
      continue
    }
    selectionSet[key] = !value
  }
}

function createExplicitSelection(select: Selection, context: SerializeContext) {
  const selectionSet: JsonSelectionSet = {}
  const computedFields = context.getComputedFields()
  const selectWithComputedFields = computeEngineSideSelection(select, computedFields)

  const keys = Object.keys(selectWithComputedFields)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = selectWithComputedFields[key]
    if (isSkip(value)) {
      continue
    }
    if (value === undefined) {
      validateSelectionForUndefined(value, context.nestSelection(key))
    }
    const computedField = computedFields?.[key]
    if (value === false || value === undefined) {
      if (computedField && !context.findField(key)) {
        continue
      }
      selectionSet[key] = false
      continue
    }
    if (value === true) {
      const field = context.findField(key)
      if (computedField && !field) {
        continue
      }
      if (field?.kind === 'object') {
        const nestedContext = context.nestSelection(key)
        selectionSet[key] = serializeFieldSelection({}, nestedContext)
      } else {
        selectionSet[key] = true
      }
      continue
    }
    if (computedField && !context.findField(key)) {
      continue
    }
    const nestedContext = context.nestSelection(key)
    selectionSet[key] = serializeFieldSelection(value, nestedContext)
  }
  return selectionSet
}

function serializeArgumentsValue(
  jsValue: Exclude<JsInputValue, undefined | Skip>,
  context: SerializeContext,
): JsonArgumentValue {
  if (jsValue === null) {
    return null
  }

  if (typeof jsValue === 'string' || typeof jsValue === 'number' || typeof jsValue === 'boolean') {
    return jsValue
  }

  if (typeof jsValue === 'bigint') {
    return { $type: 'BigInt', value: String(jsValue) }
  }

  if (isDate(jsValue)) {
    if (isValidDate(jsValue)) {
      return { $type: 'DateTime', value: jsValue.toISOString() }
    } else {
      context.throwValidationError({
        kind: 'InvalidArgumentValue',
        selectionPath: context.getSelectionPath(),
        argumentPath: context.getArgumentPath(),
        argument: {
          name: context.getArgumentName(),
          typeNames: ['Date'],
        },
        underlyingError: 'Provided Date object is invalid',
      })
    }
  }

  if (isParam(jsValue)) {
    return { $type: 'Param', value: jsValue.name }
  }

  if (isFieldRef(jsValue)) {
    return { $type: 'FieldRef', value: { _ref: jsValue.name, _container: jsValue.modelName } }
  }

  if (Array.isArray(jsValue)) {
    return serializeArgumentsArray(jsValue, context)
  }

  if (ArrayBuffer.isView(jsValue)) {
    const { buffer, byteOffset, byteLength } = jsValue
    // TODO(perf): get rid of this conversion
    return { $type: 'Bytes', value: Buffer.from(buffer, byteOffset, byteLength).toString('base64') }
  }

  if (isRawParameters(jsValue)) {
    return jsValue.values
  }

  if (isDecimalJsLike(jsValue)) {
    return { $type: 'Decimal', value: jsValue.toFixed() }
  }

  if (isObjectEnumValue(jsValue)) {
    const name = jsValue._getName()
    if (name !== 'DbNull' && name !== 'JsonNull' && name !== 'AnyNull') {
      throw new Error(`Invalid ObjectEnumValue: expected DbNull, JsonNull, or AnyNull, got ${name}`)
    }
    return { $type: 'Enum', value: name }
  }

  if (isJSONConvertible(jsValue)) {
    return jsValue.toJSON() as JsonArgumentValue
  }

  if (typeof jsValue === 'object') {
    return serializeArgumentsObject(jsValue, context)
  }

  context.throwValidationError({
    kind: 'InvalidArgumentValue',
    selectionPath: context.getSelectionPath(),
    argumentPath: context.getArgumentPath(),
    argument: {
      name: context.getArgumentName(),
      typeNames: [],
    },
    underlyingError: `We could not serialize ${Object.prototype.toString.call(
      jsValue,
    )} value. Serialize the object to JSON or implement a ".toJSON()" method on it`,
  })
}

function serializeArgumentsObject(
  object: Record<string, JsInputValue>,
  context: SerializeContext,
): Record<string, JsonArgumentValue> | RawTaggedValue {
  if (context.shouldWrapRawValues()) {
    if (object['$type']) {
      return { $type: 'Raw', value: object }
    }
  }
  const result: Record<string, JsonArgumentValue> = {}
  for (const key in object) {
    const value = object[key]
    if (isSkip(value)) {
      continue
    }
    if (value !== undefined) {
      if (value === null) {
        result[key] = null
        continue
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value
        continue
      }
      if (typeof value === 'bigint') {
        result[key] = { $type: 'BigInt', value: String(value) }
        continue
      }

      const nestedContext = context.nestArgument(key)
      result[key] = serializeArgumentsValue(value, nestedContext)
    } else if (context.isPreviewFeatureOn('strictUndefinedChecks')) {
      const nestedContext = context.nestArgument(key)
      context.throwValidationError({
        kind: 'InvalidArgumentValue',
        argumentPath: nestedContext.getArgumentPath(),
        selectionPath: context.getSelectionPath(),
        argument: { name: context.getArgumentName(), typeNames: [] },
        underlyingError: STRICT_UNDEFINED_ERROR_MESSAGE,
      })
    }
  }
  return result
}

function serializeArgumentsArray(array: JsInputValue[], context: SerializeContext): JsonArgumentValue[] {
  const result: JsonArgumentValue[] = []
  for (let i = 0; i < array.length; i++) {
    const value = array[i]
    if (value === undefined || isSkip(value)) {
      const itemContext = context.nestArgument(String(i))
      const valueName = value === undefined ? 'undefined' : `Prisma.skip`
      context.throwValidationError({
        kind: 'InvalidArgumentValue',
        selectionPath: itemContext.getSelectionPath(),
        argumentPath: itemContext.getArgumentPath(),
        argument: {
          name: `${context.getArgumentName()}[${i}]`,
          typeNames: [],
        },
        underlyingError: `Can not use \`${valueName}\` value within array. Use \`null\` or filter out \`${valueName}\` values`,
      })
    }

    if (value === null) {
      result.push(null)
      continue
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result.push(value)
      continue
    }
    if (typeof value === 'bigint') {
      result.push({ $type: 'BigInt', value: String(value) })
      continue
    }

    const itemContext = context.nestArgument(String(i))
    result.push(serializeArgumentsValue(value, itemContext))
  }
  return result
}

function isRawParameters(value: JsInputValue): value is RawParameters {
  return typeof value === 'object' && value !== null && value['__prismaRawParameters__'] === true
}

function isJSONConvertible(value: JsInputValue): value is JsonConvertible {
  return typeof value === 'object' && value !== null && typeof value['toJSON'] === 'function'
}

function validateSelectionForUndefined(value: unknown, context: SerializeContext) {
  if (value === undefined && context.isPreviewFeatureOn('strictUndefinedChecks')) {
    context.throwValidationError({
      kind: 'InvalidSelectionValue',
      selectionPath: context.getSelectionPath(),
      underlyingError: STRICT_UNDEFINED_ERROR_MESSAGE,
    })
  }
}

type ContextParams = {
  runtimeDataModel: RuntimeDataModel
  originalMethod: string
  rootArgs: JsArgs | undefined
  extensions: MergedExtensionsList
  selectionPath?: PathNode
  argumentPath?: PathNode
  modelName?: string
  action: Action
  callsite?: CallSite
  errorFormat: ErrorFormat
  clientVersion: string
  previewFeatures: string[]
  globalOmit?: GlobalOmitOptions
  wrapRawValues?: boolean
}

type PathNode = {
  parent: PathNode | undefined
  value: string
  length: number
}

function appendPath(parent: PathNode | undefined, value: string): PathNode {
  return {
    parent,
    value,
    length: (parent?.length ?? 0) + 1,
  }
}

function pathToArray(path: PathNode | undefined): string[] {
  if (!path) {
    return []
  }

  const result = new Array<string>(path.length)
  let index = path.length
  for (let node: PathNode | undefined = path; node; node = node.parent) {
    result[--index] = node.value
  }
  return result
}

class SerializeContext {
  public readonly modelOrType: RuntimeModel | undefined
  constructor(private params: ContextParams) {
    if (this.params.modelName) {
      // TODO: throw if not found
      this.modelOrType =
        this.params.runtimeDataModel.models[this.params.modelName] ??
        this.params.runtimeDataModel.types[this.params.modelName]
    }
  }

  throwValidationError(error: ValidationError): never {
    throwValidationException({
      errors: [error],
      originalMethod: this.params.originalMethod,
      args: this.params.rootArgs ?? {},
      callsite: this.params.callsite,
      errorFormat: this.params.errorFormat,
      clientVersion: this.params.clientVersion,
      globalOmit: this.params.globalOmit,
    })
  }

  getSelectionPath() {
    return pathToArray(this.params.selectionPath)
  }

  getArgumentPath() {
    return pathToArray(this.params.argumentPath)
  }

  getArgumentName(): string {
    return this.params.argumentPath?.value as string
  }

  getOutputTypeDescription(): OutputTypeDescription | undefined {
    if (!this.params.modelName || !this.modelOrType) {
      return undefined
    }
    return {
      name: this.params.modelName,
      fields: this.modelOrType.fields.map((field) => ({
        name: field.name,
        typeName: 'boolean',
        isRelation: field.kind === 'object',
      })),
    }
  }

  isRawAction() {
    switch (this.params.action) {
      case 'executeRaw':
      case 'queryRaw':
      case 'runCommandRaw':
      case 'findRaw':
      case 'aggregateRaw':
        return true
      default:
        return false
    }
  }

  isPreviewFeatureOn(previewFeature: string) {
    return this.params.previewFeatures.includes(previewFeature)
  }

  shouldWrapRawValues(): boolean {
    return this.params.wrapRawValues ?? true
  }

  getComputedFields() {
    if (!this.params.modelName) {
      return undefined
    }

    return this.params.extensions.getAllComputedFields(this.params.modelName)
  }

  findField(name: string) {
    return this.modelOrType?.fields.find((field) => field.name === name)
  }

  nestSelection(fieldName: string) {
    const field = this.findField(fieldName)
    const modelName = field?.kind === 'object' ? field.type : undefined

    return new SerializeContext({
      ...this.params,
      modelName,
      selectionPath: appendPath(this.params.selectionPath, fieldName),
    })
  }

  getGlobalOmit(): Record<string, boolean> {
    if (this.params.modelName && this.shouldApplyGlobalOmit()) {
      return this.params.globalOmit?.[uncapitalize(this.params.modelName)] ?? {}
    }
    return {}
  }

  shouldApplyGlobalOmit(): boolean {
    switch (this.params.action) {
      case 'findFirst':
      case 'findFirstOrThrow':
      case 'findUniqueOrThrow':
      case 'findMany':
      case 'upsert':
      case 'findUnique':
      case 'createManyAndReturn':
      case 'create':
      case 'update':
      case 'updateManyAndReturn':
      case 'delete':
        return true
      case 'executeRaw':
      case 'aggregateRaw':
      case 'runCommandRaw':
      case 'findRaw':
      case 'createMany':
      case 'deleteMany':
      case 'groupBy':
      case 'updateMany':
      case 'count':
      case 'aggregate':
      case 'queryRaw':
        return false
      default:
        assertNever(this.params.action, 'Unknown action')
    }
  }

  nestArgument(fieldName: string) {
    return new SerializeContext({
      ...this.params,
      argumentPath: appendPath(this.params.argumentPath, fieldName),
    })
  }
}
