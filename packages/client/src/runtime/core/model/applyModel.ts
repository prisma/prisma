import * as DMMF from '@prisma/dmmf'
import type { O } from 'ts-toolbelt'

import { type Client, type InternalRequestParams } from '../../getPrismaClient'
import { getCallSite } from '../../utils/CallSite'
import {
  addObjectProperties,
  addProperty,
  cacheProperties,
  CompositeProxyLayer,
  createCompositeProxy,
} from '../compositeProxy'
import type { PrecomputedQueryPlanCacheHit } from '../engines'
import type { QueryEngineResultData } from '../engines/common/types/QueryEngine'
import { getBatchId } from '../jsonProtocol/getBatchId'
import { isWrite } from '../jsonProtocol/isWrite'
import { serializeJsonQuery } from '../jsonProtocol/serializeJsonQuery'
import type { PrismaPromise, PrismaPromiseTransaction } from '../request/PrismaPromise'
import type { UserArgs } from '../request/UserArgs'
import type { Action } from '../types/exported/JsApi'
import { applyAggregates } from './applyAggregates'
import { applyFieldsProxy } from './applyFieldsProxy'
import { applyFluent } from './applyFluent'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'

export type ModelAction = (
  paramOverrides: O.Optional<InternalRequestParams>,
) => (userArgs?: UserArgs) => PrismaPromise<unknown>

type LazyDescriptor = {
  protocolQuery: Parameters<Client['_engine']['request']>[0]
  root: LazyDescriptorNode
  precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit
  precomputedBatchId?: string
}

type LazyDescriptorExtraction = {
  descriptor: LazyDescriptor
  precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit
}

type LazyDescriptorNode =
  | { kind: 'constant'; value: unknown }
  | { kind: 'placeholder'; name: string; valueType: string }
  | { kind: 'array'; items: LazyDescriptorNode[] }
  | { kind: 'object'; keys: string[]; fields: Record<string, LazyDescriptorNode> }

type EngineWithPrecomputed = Client['_engine'] & {
  requestPrecomputedCachedResult?: <T>(
    query: Parameters<Client['_engine']['request']>[0],
    precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit,
    options: Parameters<Client['_engine']['request']>[1],
  ) => Promise<T>
  requestWithPrecomputedQueryPlanCacheHit?: <T>(
    query: Parameters<Client['_engine']['request']>[0],
    options: Parameters<Client['_engine']['request']>[1],
  ) => Promise<{
    response: QueryEngineResultData<T>
    precomputedQueryPlanCacheHit?: PrecomputedQueryPlanCacheHit
  }>
  getPrecomputedQueryPlanCacheHit?: (
    query: Parameters<Client['_engine']['request']>[0],
  ) => PrecomputedQueryPlanCacheHit | undefined
}

const fluentProps = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'create',
  'update',
  'upsert',
  'delete',
] as const
const aggregateProps = ['aggregate', 'count', 'groupBy'] as const
const requestHandlerPrecomputedCachedResultProps = ['findMany', 'findFirst', 'findFirstOrThrow'] as const
const maxLazyDescriptors = 2

/**
 * Dynamically creates a model interface via a proxy.
 * @param client to trigger the request execution
 * @param dmmfModelName the dmmf name of the model
 * @returns
 */
export function applyModel(client: Client, dmmfModelName: string) {
  const modelExtensions = client._extensions.getAllModelExtensions(dmmfModelName) ?? {}

  const layers = [
    cacheProperties(modelActionsLayer(client, dmmfModelName)),
    fieldsPropertyLayer(client, dmmfModelName),
    addObjectProperties(modelExtensions),
    addProperty('name', () => dmmfModelName),
    addProperty('$name', () => dmmfModelName),
    addProperty('$parent', () => client._appliedParent),
  ]

  return createCompositeProxy({}, layers)
}

/**
 * Dynamically creates a model interface via a proxy.
 * @param client to trigger the request execution
 * @param dmmfModelName the dmmf name of the model
 * @returns
 */
function modelActionsLayer(client: Client, dmmfModelName: string): CompositeProxyLayer<string> {
  // we use the javascript model name for display purposes
  const jsModelName = dmmfToJSModelName(dmmfModelName)
  const ownKeys = Object.keys(DMMF.ModelAction).concat('count')

  return {
    getKeys() {
      return ownKeys
    },

    getPropertyValue(key) {
      const dmmfActionName = key as DMMF.ModelAction
      const clientMethod = `${jsModelName}.${key}`

      // we return a function as the model action that we want to expose
      // it takes user args and executes the request in a Prisma Promise
      let descriptors: LazyDescriptor[] | undefined
      const action = (paramOverrides: O.Optional<InternalRequestParams>) => (userArgs?: UserArgs) => {
        return client._createPrismaPromise(
          (transaction) => {
            if (canUseEnginePrecomputedFastPath(client, paramOverrides, transaction)) {
              const fastPath = tryEnginePrecomputedFastPath({
                client,
                args: userArgs,
                action: dmmfActionName,
                model: dmmfModelName,
                clientMethod,
                descriptors,
                rememberDescriptor: (nextDescriptor) => {
                  descriptors = rememberLazyDescriptor(descriptors, nextDescriptor)
                },
              })

              if (fastPath !== undefined) {
                return fastPath
              }
            }

            if (
              canUseRequestHandlerPrecomputedCachedResultFastPath(client, paramOverrides, transaction, dmmfActionName)
            ) {
              const fastPath = tryRequestHandlerPrecomputedCachedResultFastPath({
                client,
                args: userArgs,
                action: dmmfActionName,
                model: dmmfModelName,
                clientMethod,
                paramOverrides,
                descriptors,
              })

              if (fastPath !== undefined) {
                return fastPath
              }
            }

            if (canUseRequestPrecomputedFastPath(client, paramOverrides, transaction)) {
              const fastPath = tryRequestPrecomputedFastPath({
                client,
                args: userArgs,
                action: dmmfActionName,
                model: dmmfModelName,
                clientMethod,
                paramOverrides,
                descriptors,
                rememberDescriptor: (nextDescriptor) => {
                  descriptors = rememberLazyDescriptor(descriptors, nextDescriptor)
                },
              })

              if (fastPath !== undefined) {
                return fastPath
              }
            }

            const callSite = 'callsite' in paramOverrides ? paramOverrides.callsite : getCallSite(client._errorFormat)
            const params: InternalRequestParams = {
              // data and its dataPath for nested results
              args: userArgs,
              dataPath: [],

              // action name and its related model
              action: dmmfActionName,
              model: dmmfModelName,

              // method name for display only
              clientMethod,
              jsModelName,

              // transaction information
              transaction,

              // stack trace
              callsite: callSite,
            }

            return client._request({ ...params, ...paramOverrides })
          },
          {
            action: dmmfActionName,
            args: userArgs,
            model: dmmfModelName,
          },
        )
      }

      // we give the control over action for building the fluent api
      if ((fluentProps as readonly string[]).includes(dmmfActionName)) {
        return applyFluent(client, dmmfModelName, action)
      }

      // we handle the edge case of aggregates that need extra steps
      if (isValidAggregateName(key)) {
        return applyAggregates(client, key, action)
      }

      return action({}) // and by default, don't override any params
    },
  }
}

function canUseEnginePrecomputedFastPath(
  client: Client,
  paramOverrides: O.Optional<InternalRequestParams>,
  transaction: PrismaPromiseTransaction | undefined,
): boolean {
  return (
    client._enginePrecomputedFastPath === true &&
    transaction === undefined &&
    canIgnorePrecomputedFastPathParamOverrides(paramOverrides) &&
    client._extensions.isEmpty() &&
    client._globalOmit === undefined &&
    client._engineConfig.sqlCommenters === undefined &&
    client._engineConfig.adapter !== undefined &&
    typeof (client._engine as EngineWithPrecomputed).requestWithPrecomputedQueryPlanCacheHit === 'function'
  )
}

function canIgnorePrecomputedFastPathParamOverrides(paramOverrides: O.Optional<InternalRequestParams>): boolean {
  const keys = Object.keys(paramOverrides)
  if (keys.length === 0) {
    return true
  }

  if (keys.length === 1 && keys[0] === 'dataPath') {
    return Array.isArray(paramOverrides.dataPath) && paramOverrides.dataPath.length === 0
  }

  if (
    keys.length === 2 &&
    Object.hasOwn(paramOverrides, 'callsite') &&
    Object.hasOwn(paramOverrides, 'dataPath') &&
    Array.isArray(paramOverrides.dataPath) &&
    paramOverrides.dataPath.length === 0
  ) {
    return true
  }

  return false
}

function canUseRequestHandlerPrecomputedCachedResultFastPath(
  client: Client,
  paramOverrides: O.Optional<InternalRequestParams>,
  transaction: PrismaPromiseTransaction | undefined,
  action: Action,
): boolean {
  return (
    client._requestPrecomputedFastPath === true &&
    transaction === undefined &&
    isRequestHandlerPrecomputedCachedResultAction(action) &&
    canIgnorePrecomputedFastPathParamOverrides(paramOverrides) &&
    client._extensions.isEmpty() &&
    client._globalOmit === undefined &&
    client._engineConfig.sqlCommenters === undefined &&
    !client._tracingHelper.isEnabled() &&
    !client._isClientDebugEnabled() &&
    client._engineConfig.adapter !== undefined &&
    typeof (client._engine as EngineWithPrecomputed).requestPrecomputedCachedResult === 'function'
  )
}

function isRequestHandlerPrecomputedCachedResultAction(
  action: Action,
): action is (typeof requestHandlerPrecomputedCachedResultProps)[number] {
  return (requestHandlerPrecomputedCachedResultProps as readonly string[]).includes(action)
}

function canUseRequestPrecomputedFastPath(
  client: Client,
  paramOverrides: O.Optional<InternalRequestParams>,
  transaction: PrismaPromiseTransaction | undefined,
): boolean {
  return (
    client._requestPrecomputedFastPath === true &&
    transaction === undefined &&
    canIgnorePrecomputedFastPathParamOverrides(paramOverrides) &&
    client._extensions.isEmpty() &&
    client._globalOmit === undefined &&
    !client._tracingHelper.isEnabled() &&
    !client._isClientDebugEnabled() &&
    client._engineConfig.adapter !== undefined &&
    typeof (client._engine as EngineWithPrecomputed).getPrecomputedQueryPlanCacheHit === 'function'
  )
}

function tryEnginePrecomputedFastPath({
  client,
  args,
  action,
  model,
  clientMethod,
  descriptors,
  rememberDescriptor,
}: {
  client: Client
  args: unknown
  action: Action
  model: string
  clientMethod: string
  descriptors: LazyDescriptor[] | undefined
  rememberDescriptor: (descriptor: LazyDescriptor) => void
}): Promise<unknown> | undefined {
  const extraction = tryExtractLazyDescriptors(descriptors, args)
  if (extraction !== undefined) {
    const { descriptor, precomputedQueryPlanCacheHit } = extraction
    const engine = client._engine as EngineWithPrecomputed
    if (engine.requestPrecomputedCachedResult !== undefined) {
      return engine.requestPrecomputedCachedResult(descriptor.protocolQuery, precomputedQueryPlanCacheHit, {
        isWrite: isWrite(descriptor.protocolQuery.action),
      })
    }

    return client._engine
      .request<Record<string, unknown>>(descriptor.protocolQuery, {
        isWrite: isWrite(descriptor.protocolQuery.action),
        precomputedQueryPlanCacheHit,
      })
      .then((response) => response.data[descriptor.protocolQuery.action])
  }

  const query = serializeJsonQuery({
    modelName: model,
    runtimeDataModel: client._runtimeDataModel,
    action,
    args: args as UserArgs,
    clientMethod,
    extensions: client._extensions,
    errorFormat: client._errorFormat,
    clientVersion: client._clientVersion,
    previewFeatures: client._previewFeatures,
    globalOmit: client._globalOmit,
  })

  const engine = client._engine as EngineWithPrecomputed

  if (engine.requestWithPrecomputedQueryPlanCacheHit === undefined) {
    return undefined
  }

  return engine
    .requestWithPrecomputedQueryPlanCacheHit<Record<string, unknown>>(query, {
      isWrite: isWrite(query.action),
    })
    .then(({ response, precomputedQueryPlanCacheHit }) => {
      if (precomputedQueryPlanCacheHit !== undefined) {
        const learned = buildLazyDescriptor(args, query, precomputedQueryPlanCacheHit)
        if (learned !== undefined) {
          rememberDescriptor(learned)
        }
      }

      return response.data[query.action]
    })
}

function tryRequestPrecomputedFastPath({
  client,
  args,
  action,
  model,
  clientMethod,
  paramOverrides,
  descriptors,
  rememberDescriptor,
}: {
  client: Client
  args: unknown
  action: Action
  model: string
  clientMethod: string
  paramOverrides: O.Optional<InternalRequestParams>
  descriptors: LazyDescriptor[] | undefined
  rememberDescriptor: (descriptor: LazyDescriptor) => void
}): Promise<unknown> | undefined {
  const extraction = tryExtractLazyDescriptors(descriptors, args)
  if (extraction !== undefined) {
    const { descriptor, precomputedQueryPlanCacheHit } = extraction
    return requestWithPrecomputedQueryPlanCacheHit({
      client,
      args,
      action,
      model,
      clientMethod,
      paramOverrides,
      protocolQuery: descriptor.protocolQuery,
      precomputedQueryPlanCacheHit,
      precomputedBatchId: descriptor.precomputedBatchId,
    })
  }

  const query = serializeJsonQuery({
    modelName: model,
    runtimeDataModel: client._runtimeDataModel,
    action,
    args: args as UserArgs,
    clientMethod,
    extensions: client._extensions,
    errorFormat: client._errorFormat,
    clientVersion: client._clientVersion,
    previewFeatures: client._previewFeatures,
    globalOmit: client._globalOmit,
  })
  const precomputedQueryPlanCacheHit = (client._engine as EngineWithPrecomputed).getPrecomputedQueryPlanCacheHit?.(
    query,
  )
  if (precomputedQueryPlanCacheHit !== undefined) {
    const learned = buildLazyDescriptor(args, query, precomputedQueryPlanCacheHit)
    if (learned !== undefined) {
      rememberDescriptor(learned)
    }
  }

  return requestWithPrecomputedQueryPlanCacheHit({
    client,
    args,
    action,
    model,
    clientMethod,
    paramOverrides,
    protocolQuery: query,
    precomputedQueryPlanCacheHit,
  })
}

function tryRequestHandlerPrecomputedCachedResultFastPath({
  client,
  args,
  action,
  model,
  clientMethod,
  paramOverrides,
  descriptors,
}: {
  client: Client
  args: unknown
  action: Action
  model: string
  clientMethod: string
  paramOverrides: O.Optional<InternalRequestParams>
  descriptors: LazyDescriptor[] | undefined
}): Promise<unknown> | undefined {
  const extraction = tryExtractLazyDescriptors(descriptors, args)
  if (extraction === undefined) {
    return undefined
  }
  const { descriptor, precomputedQueryPlanCacheHit } = extraction

  return client._requestHandler.requestPrecomputedCachedResult({
    args: args as UserArgs,
    dataPath: Array.isArray(paramOverrides.dataPath) ? paramOverrides.dataPath : [],
    action,
    modelName: model,
    clientMethod,
    extensions: client._extensions,
    callsite: 'callsite' in paramOverrides ? paramOverrides.callsite : getCallSite(client._errorFormat),
    protocolQuery: descriptor.protocolQuery,
    precomputedQueryPlanCacheHit,
  })
}

function requestWithPrecomputedQueryPlanCacheHit({
  client,
  args,
  action,
  model,
  clientMethod,
  paramOverrides,
  protocolQuery,
  precomputedQueryPlanCacheHit,
  precomputedBatchId,
}: {
  client: Client
  args: unknown
  action: Action
  model: string
  clientMethod: string
  paramOverrides: O.Optional<InternalRequestParams>
  protocolQuery: LazyDescriptor['protocolQuery']
  precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit | undefined
  precomputedBatchId?: string
}): Promise<unknown> {
  return client._requestHandler.request({
    args: args as UserArgs,
    dataPath: Array.isArray(paramOverrides.dataPath) ? paramOverrides.dataPath : [],
    action,
    modelName: model,
    clientMethod,
    extensions: client._extensions,
    callsite: 'callsite' in paramOverrides ? paramOverrides.callsite : getCallSite(client._errorFormat),
    protocolQuery,
    precomputedQueryPlanCacheHit,
    precomputedBatchId,
  })
}

function buildLazyDescriptor(
  args: unknown,
  protocolQuery: LazyDescriptor['protocolQuery'],
  precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit,
): LazyDescriptor | undefined {
  const placeholdersByValue = new Map<string, string>()
  for (const [name, value] of Object.entries(precomputedQueryPlanCacheHit.placeholderValues)) {
    const key = lazyDescriptorValueKey(value)
    if (key !== undefined) {
      placeholdersByValue.set(key, name)
    }
  }

  const descriptor: LazyDescriptor = {
    protocolQuery,
    precomputedQueryPlanCacheHit,
    precomputedBatchId: getBatchId(protocolQuery),
    root: buildLazyDescriptorNode(args, placeholdersByValue),
  }
  const extraction = tryExtractLazyDescriptor(descriptor, args)
  if (
    extraction === undefined ||
    !hasSamePlaceholders(extraction.placeholderValues, precomputedQueryPlanCacheHit.placeholderValues)
  ) {
    return undefined
  }

  return descriptor
}

function buildLazyDescriptorNode(value: unknown, placeholdersByValue: Map<string, string>): LazyDescriptorNode {
  const valueKey = lazyDescriptorValueKey(value)
  const placeholderName = valueKey === undefined ? undefined : placeholdersByValue.get(valueKey)
  if (placeholderName !== undefined) {
    return {
      kind: 'placeholder',
      name: placeholderName,
      valueType: value === null ? 'null' : typeof value,
    }
  }

  if (Array.isArray(value)) {
    return {
      kind: 'array',
      items: value.map((item) => buildLazyDescriptorNode(item, placeholdersByValue)),
    }
  }

  if (isDescriptorRecord(value)) {
    const keys = Object.keys(value)
    const fields: Record<string, LazyDescriptorNode> = {}
    for (const key of keys) {
      fields[key] = buildLazyDescriptorNode(value[key], placeholdersByValue)
    }
    return { kind: 'object', keys, fields }
  }

  return { kind: 'constant', value }
}

function tryExtractLazyDescriptor(descriptor: LazyDescriptor, args: unknown): PrecomputedQueryPlanCacheHit | undefined {
  const placeholderValues: Record<string, unknown> = {}
  if (!matchesLazyDescriptorNode(descriptor.root, args, placeholderValues)) {
    return undefined
  }

  return {
    ...descriptor.precomputedQueryPlanCacheHit,
    placeholderValues,
  }
}

function matchesLazyDescriptorNode(
  descriptor: LazyDescriptorNode,
  value: unknown,
  placeholderValues: Record<string, unknown>,
): boolean {
  switch (descriptor.kind) {
    case 'constant':
      return Object.is(value, descriptor.value)

    case 'placeholder':
      if ((value === null ? 'null' : typeof value) !== descriptor.valueType) {
        return false
      }

      if (Object.hasOwn(placeholderValues, descriptor.name)) {
        return Object.is(placeholderValues[descriptor.name], value)
      }

      placeholderValues[descriptor.name] = value
      return true

    case 'array':
      if (!Array.isArray(value) || value.length !== descriptor.items.length) {
        return false
      }
      for (let i = 0; i < descriptor.items.length; i++) {
        if (!matchesLazyDescriptorNode(descriptor.items[i], value[i], placeholderValues)) {
          return false
        }
      }
      return true

    case 'object':
      if (!isDescriptorRecord(value) || !hasExactKeys(value, descriptor.keys)) {
        return false
      }
      for (const key of descriptor.keys) {
        if (!matchesLazyDescriptorNode(descriptor.fields[key], value[key], placeholderValues)) {
          return false
        }
      }
      return true
  }
}

function tryExtractLazyDescriptors(
  descriptors: LazyDescriptor[] | undefined,
  args: unknown,
): LazyDescriptorExtraction | undefined {
  if (descriptors === undefined) {
    return undefined
  }

  for (let i = 0; i < descriptors.length; i++) {
    const descriptor = descriptors[i]
    const precomputedQueryPlanCacheHit = tryExtractLazyDescriptor(descriptor, args)
    if (precomputedQueryPlanCacheHit !== undefined) {
      promoteLazyDescriptor(descriptors, i)
      return { descriptor, precomputedQueryPlanCacheHit }
    }
  }

  return undefined
}

function rememberLazyDescriptor(
  descriptors: LazyDescriptor[] | undefined,
  descriptor: LazyDescriptor,
): LazyDescriptor[] {
  if (descriptors === undefined) {
    return [descriptor]
  }

  const cacheKey = descriptor.precomputedQueryPlanCacheHit.cacheKey
  for (let i = 0; i < descriptors.length; i++) {
    if (descriptors[i].precomputedQueryPlanCacheHit.cacheKey === cacheKey) {
      descriptors[i] = descriptor
      promoteLazyDescriptor(descriptors, i)
      return descriptors
    }
  }

  if (descriptors.length < maxLazyDescriptors) {
    descriptors.push(descriptor)
    promoteLazyDescriptor(descriptors, descriptors.length - 1)
    return descriptors
  }

  for (let i = descriptors.length - 1; i > 0; i--) {
    descriptors[i] = descriptors[i - 1]
  }
  descriptors[0] = descriptor
  return descriptors
}

function promoteLazyDescriptor(descriptors: LazyDescriptor[], index: number): void {
  if (index === 0) {
    return
  }

  const descriptor = descriptors[index]
  for (let i = index; i > 0; i--) {
    descriptors[i] = descriptors[i - 1]
  }
  descriptors[0] = descriptor
}

function lazyDescriptorValueKey(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
      return `string:${value}`
    case 'number':
      return Number.isFinite(value) ? `number:${value}` : undefined
    case 'boolean':
      return `boolean:${value ? 'true' : 'false'}`
    case 'bigint':
      return `bigint:${value}`
    default:
      return undefined
  }
}

function isDescriptorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== expectedKeys.length) {
    return false
  }

  let keysMatchInOrder = true
  for (let i = 0; i < expectedKeys.length; i++) {
    if (keys[i] !== expectedKeys[i]) {
      keysMatchInOrder = false
      break
    }
  }
  if (keysMatchInOrder) {
    return true
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      return false
    }
  }

  return true
}

function hasSamePlaceholders(extracted: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  const expectedKeys = Object.keys(expected)
  if (!hasExactKeys(extracted, expectedKeys)) {
    return false
  }

  for (const key of expectedKeys) {
    if (!Object.is(extracted[key], expected[key])) {
      return false
    }
  }

  return true
}

function isValidAggregateName(action: string): action is (typeof aggregateProps)[number] {
  return (aggregateProps as readonly string[]).includes(action)
}

function fieldsPropertyLayer(client: Client, dmmfModelName: string) {
  return cacheProperties(
    addProperty('fields', () => {
      const model = client._runtimeDataModel.models[dmmfModelName]
      return applyFieldsProxy(dmmfModelName, model)
    }),
  )
}
