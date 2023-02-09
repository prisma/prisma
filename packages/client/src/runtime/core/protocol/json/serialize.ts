import {
  JsonArgumentValue,
  JsonFieldSelection,
  JsonQuery,
  JsonQueryAction,
  JsonSelectionSet,
} from '@prisma/engine-core'
import { DMMF } from '@prisma/generator-helper'
import { assertNever } from '@prisma/internals'
import Decimal from 'decimal.js'

import { BaseDMMFHelper } from '../../../dmmf'
import { ObjectEnumValue, objectEnumValues } from '../../../object-enums'
import { isDecimalJsLike } from '../../../utils/decimalJsLike'
import { MergedExtensionsList } from '../../extensions/MergedExtensionsList'
import { applyComputedFieldsToSelection } from '../../extensions/resultUtils'
import { isFieldRef } from '../../model/FieldRef'
import { Action, JsArgs, JsInputValue, RawParameters, Selection } from '../../types/JsApi'

const jsActionToProtocolAction: Record<Action, JsonQueryAction> = {
  findUnique: 'findUnique',
  findUniqueOrThrow: 'findUniqueOrThrow',
  findFirst: 'findFirst',
  findFirstOrThrow: 'findFirstOrThrow',
  findMany: 'findMany',
  count: 'aggregate',
  create: 'createOne',
  createMany: 'createMany',
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

export type SerializeParams = {
  baseDmmf: BaseDMMFHelper
  modelName?: string
  action: Action
  args?: JsArgs
  extensions: MergedExtensionsList
}

export function serializeJsonQuery({ modelName, action, args, baseDmmf, extensions }: SerializeParams): JsonQuery {
  const context = new SerializeContext(action, baseDmmf, extensions, [], modelName)
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
  return {
    arguments: serializeArgumentsObject(args),
    selection: serializeSelectionSet(select, include, context),
  }
}

function serializeSelectionSet(
  select: Selection | undefined,
  include: Selection | undefined,
  context: SerializeContext,
): JsonSelectionSet {
  if (select && include) {
    throw new Error('select and include are used at the same time')
  }

  if (select) {
    return createExplicitSelection(select, context)
  }

  const selectionSet: JsonSelectionSet = {}

  if (context.model && !context.isRawAction()) {
    selectionSet.$composites = true
    selectionSet.$scalars = true
  }

  if (include) {
    for (const [key, value] of Object.entries(include)) {
      if (value === true) {
        selectionSet[key] = {
          selection: {
            $composites: true,
            $scalars: true,
          },
        }
      } else if (typeof value === 'object') {
        selectionSet[key] = serializeFieldSelection(value, context.atField(key))
      }
    }
  }
  return selectionSet
}

function createExplicitSelection(select: Selection, context: SerializeContext) {
  const selectionSet: JsonSelectionSet = {}
  const computedFields = context.getComputedFields()
  const selectWithComputedFields = applyComputedFieldsToSelection(select, computedFields)

  for (const [key, value] of Object.entries(selectWithComputedFields)) {
    const field = context.findField(key)
    if (computedFields?.[key] && !field) {
      continue
    }
    if (value === true) {
      selectionSet[key] = defaultSelectionForField(field)
    } else if (typeof value === 'object') {
      selectionSet[key] = serializeFieldSelection(value, context.atField(key))
    }
  }
  return selectionSet
}

function defaultSelectionForField(field?: DMMF.Field) {
  if (field?.kind === 'object') {
    return { selection: { $composites: true, $scalars: true } }
  }
  return true
}

function serializeArgumentsValue(jsValue: Exclude<JsInputValue, undefined>): JsonArgumentValue {
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
    return { $type: 'DateTime', value: jsValue.toISOString() }
  }

  if (isFieldRef(jsValue)) {
    return { $type: 'FieldRef', value: { _ref: jsValue.name } }
  }

  if (Array.isArray(jsValue)) {
    return serializeArgumentsArray(jsValue)
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

  if (typeof jsValue === 'object') {
    return serializeArgumentsObject(jsValue)
  }

  assertNever(jsValue, 'Unknown value type')
}

function serializeArgumentsObject(object: Record<string, JsInputValue>): Record<string, JsonArgumentValue> {
  if (object['$type']) {
    return { $type: 'Json', value: JSON.stringify(object) }
  }
  const result: Record<string, JsonArgumentValue> = {}
  for (const key in object) {
    const value = object[key]
    if (value !== undefined) {
      result[key] = serializeArgumentsValue(value)
    }
  }
  return result
}

function serializeArgumentsArray(array: JsInputValue[]): JsonArgumentValue[] {
  const result: JsonArgumentValue[] = []
  for (const value of array) {
    if (value !== undefined) {
      result.push(serializeArgumentsValue(value))
    }
  }
  return result
}

function isDate(value: unknown): value is Date {
  return Object.prototype.toString.call(value) === '[object Date]'
}

function isRawParameters(value: JsInputValue): value is RawParameters {
  return typeof value === 'object' && value !== null && value['__prismaRawParameters__'] === true
}

class SerializeContext {
  public readonly model: DMMF.Model | undefined
  constructor(
    public readonly action: Action,
    private baseDMMF: BaseDMMFHelper,
    private extensions: MergedExtensionsList,
    public path: string[],
    modelName?: string,
  ) {
    if (modelName) {
      // TODO: throw if not found
      this.model = this.baseDMMF.modelMap[modelName]
    }
  }

  isRawAction() {
    return ['executeRaw', 'queryRaw', 'runCommandRaw', 'findRaw', 'aggregateRaw'].includes(this.action)
  }

  getComputedFields() {
    if (!this.model) {
      return undefined
    }
    return this.extensions.getAllComputedFields(this.model.name)
  }

  findField(name: string) {
    return this.model?.fields.find((field) => field.name === name)
  }

  atField(fieldName: string) {
    const field = this.findField(fieldName)
    const modelName = field?.kind === 'object' ? field.type : undefined
    return new SerializeContext(this.action, this.baseDMMF, this.extensions, this.path.concat(fieldName), modelName)
  }
}
