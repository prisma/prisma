import { lowerCase } from '../../../utils/lowerCase'
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
import { RuntimeDataModel, RuntimeModel } from '../runtimeDataModel'
import {
  Action,
  JsArgs,
  JsInputValue,
  JsonConvertible,
  Omission,
  RawParameters,
  Selection,
} from '../types/exported/JsApi'
import { ObjectEnumValue, objectEnumValues } from '../types/exported/ObjectEnums'
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
  extensions: MergedExtensionsList
  callsite?: CallSite
  clientMethod: string
  clientVersion: string
  errorFormat: ErrorFormat
  previewFeatures: string[]
  globalOmit?: GlobalOmitOptions
}

export function serializeJsonQuery({
  modelName,
  action,
  args,
  runtimeDataModel,
  extensions,
  callsite,
  clientMethod,
  errorFormat,
  clientVersion,
  previewFeatures,
  globalOmit,
}: SerializeParams): JsonQuery {
  const context = new SerializeContext({
    runtimeDataModel,
    modelName,
    action,
    rootArgs: args,
    callsite,
    extensions,
    selectionPath: [],
    argumentPath: [],
    originalMethod: clientMethod,
    errorFormat,
    clientVersion,
    previewFeatures,
    globalOmit,
  })
  return {
    modelName,
    action: jsActionToProtocolAction[action],
    query: serializeFieldSelection(args, context),
  }
}

function serializeFieldSelection(
  { select, include, ...args }: JsArgs = {},
  context: SerializeContext,
): JsonFieldSelection {
  let omit: Omission | undefined
  if (context.isPreviewFeatureOn('omitApi')) {
    omit = args.omit
    delete args.omit
  }
  return {
    arguments: serializeArgumentsObject(args, context),
    selection: serializeSelectionSet(select, include, omit, context),
  }
}

function serializeSelectionSet(
  select: Selection | undefined,
  include: Selection | undefined,
  omit: Record<string, boolean> | undefined,
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
    } else if (omit && context.isPreviewFeatureOn('omitApi')) {
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
  omit: Record<string, boolean> | undefined,
) {
  const selectionSet: JsonSelectionSet = {}

  if (context.model && !context.isRawAction()) {
    selectionSet.$composites = true
    selectionSet.$scalars = true
  }

  if (include) {
    addIncludedRelations(selectionSet, include, context)
  }

  if (context.isPreviewFeatureOn('omitApi')) {
    omitFields(selectionSet, omit, context)
  }

  return selectionSet
}

function addIncludedRelations(selectionSet: JsonSelectionSet, include: Selection, context: SerializeContext) {
  for (const [key, value] of Object.entries(include)) {
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
      selectionSet[key] = serializeFieldSelection(value === true ? {} : value, context.nestSelection(key))
    } else if (value === true) {
      selectionSet[key] = true
    } else {
      // value is an object, field is unknown
      // this can either be user error (in that case, qe will respond with an error)
      // or virtual field not present on datamodel (like `_count`).
      // Since we don't know which one cast is, we still attempt to serialize selection
      selectionSet[key] = serializeFieldSelection(value, context.nestSelection(key))
    }
  }
}

function omitFields(selectionSet: JsonSelectionSet, localOmit: Omission | undefined, context: SerializeContext) {
  const computedFields = context.getComputedFields()
  const combinedOmits = { ...context.getGlobalOmit(), ...localOmit }
  const omitWithComputedFields = computeEngineSideOmissions(combinedOmits, computedFields)
  for (const [key, value] of Object.entries(omitWithComputedFields)) {
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

  for (const [key, value] of Object.entries(selectWithComputedFields)) {
    const field = context.findField(key)
    if (computedFields?.[key] && !field) {
      continue
    }
    if (value === false) {
      selectionSet[key] = false
      continue
    }
    if (value === true) {
      if (field?.kind === 'object') {
        selectionSet[key] = serializeFieldSelection({}, context.nestSelection(key))
      } else {
        selectionSet[key] = true
      }
      continue
    }
    selectionSet[key] = serializeFieldSelection(value, context.nestSelection(key))
  }
  return selectionSet
}

function serializeArgumentsValue(
  jsValue: Exclude<JsInputValue, undefined>,
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

  if (isFieldRef(jsValue)) {
    return { $type: 'FieldRef', value: { _ref: jsValue.name, _container: jsValue.modelName } }
  }

  if (Array.isArray(jsValue)) {
    return serializeArgumentsArray(jsValue, context)
  }

  if (ArrayBuffer.isView(jsValue)) {
    return { $type: 'Bytes', value: Buffer.from(jsValue).toString('base64') }
  }

  if (isRawParameters(jsValue)) {
    return jsValue.values
  }

  if (isDecimalJsLike(jsValue)) {
    return { $type: 'Decimal', value: jsValue.toFixed() }
  }

  if (jsValue instanceof ObjectEnumValue) {
    if (jsValue !== objectEnumValues.instances[jsValue._getName()]) {
      throw new Error('Invalid ObjectEnumValue')
    }
    return { $type: 'Enum', value: jsValue._getName() }
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
  if (object['$type']) {
    return { $type: 'Raw', value: object }
  }
  const result: Record<string, JsonArgumentValue> = {}
  for (const key in object) {
    const value = object[key]
    if (value !== undefined) {
      result[key] = serializeArgumentsValue(value, context.nestArgument(key))
    }
  }
  return result
}

function serializeArgumentsArray(array: JsInputValue[], context: SerializeContext): JsonArgumentValue[] {
  const result: JsonArgumentValue[] = []
  for (let i = 0; i < array.length; i++) {
    const itemContext = context.nestArgument(String(i))
    const value = array[i]
    if (value === undefined) {
      context.throwValidationError({
        kind: 'InvalidArgumentValue',
        selectionPath: itemContext.getSelectionPath(),
        argumentPath: itemContext.getArgumentPath(),
        argument: {
          name: `${context.getArgumentName()}[${i}]`,
          typeNames: [],
        },
        underlyingError: 'Can not use `undefined` value within array. Use `null` or filter out `undefined` values',
      })
    }
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

type ContextParams = {
  runtimeDataModel: RuntimeDataModel
  originalMethod: string
  rootArgs: JsArgs | undefined
  extensions: MergedExtensionsList
  selectionPath: string[]
  argumentPath: string[]
  modelName?: string
  action: Action
  callsite?: CallSite
  errorFormat: ErrorFormat
  clientVersion: string
  previewFeatures: string[]
  globalOmit?: GlobalOmitOptions
}

class SerializeContext {
  public readonly model: RuntimeModel | undefined
  constructor(private params: ContextParams) {
    if (this.params.modelName) {
      // TODO: throw if not found
      this.model =
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
    })
  }

  getSelectionPath() {
    return this.params.selectionPath
  }

  getArgumentPath() {
    return this.params.argumentPath
  }

  getArgumentName() {
    return this.params.argumentPath[this.params.argumentPath.length - 1]
  }

  getOutputTypeDescription(): OutputTypeDescription | undefined {
    if (!this.params.modelName || !this.model) {
      return undefined
    }
    return {
      name: this.params.modelName,
      fields: this.model.fields.map((field) => ({
        name: field.name,
        typeName: 'boolean',
        isRelation: field.kind === 'object',
      })),
    }
  }

  isRawAction() {
    return ['executeRaw', 'queryRaw', 'runCommandRaw', 'findRaw', 'aggregateRaw'].includes(this.params.action)
  }

  isPreviewFeatureOn(previewFeature: string) {
    return this.params.previewFeatures.includes(previewFeature)
  }

  getComputedFields() {
    if (!this.params.modelName) {
      return undefined
    }

    return this.params.extensions.getAllComputedFields(this.params.modelName)
  }

  findField(name: string) {
    return this.model?.fields.find((field) => field.name === name)
  }

  nestSelection(fieldName: string) {
    const field = this.findField(fieldName)
    const modelName = field?.kind === 'object' ? field.type : undefined

    return new SerializeContext({
      ...this.params,
      modelName,
      selectionPath: this.params.selectionPath.concat(fieldName),
    })
  }

  getGlobalOmit(): Record<string, boolean> {
    if (!this.params.modelName) {
      return {}
    }
    return this.params.globalOmit?.[lowerCase(this.params.modelName)] ?? {}
  }

  nestArgument(fieldName: string) {
    return new SerializeContext({
      ...this.params,
      argumentPath: this.params.argumentPath.concat(fieldName),
    })
  }
}
