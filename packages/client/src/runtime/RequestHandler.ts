import { Context } from '@opentelemetry/api'
import { deserializeJsonObject } from '@prisma/client-engine-runtime'
import { hasBatchIndex } from '@prisma/client-runtime-utils'
import { Debug } from '@prisma/debug'
import { assertNever } from '@prisma/internals'
import stripAnsi from 'strip-ansi'

import {
  EngineValidationError,
  InteractiveTransactionOptions,
  JsonQuery,
  LogEmitter,
  TransactionOptions,
} from '../runtime/core/engines'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '.'
import { AccelerateExtensionFetchDecorator, PrecomputedQueryPlanCacheHit } from './core/engines/common/Engine'
import { QueryEngineResultData, queryEngineResultDataWasDeserialized } from './core/engines/common/types/QueryEngine'
import { throwValidationException } from './core/errorRendering/throwValidationException'
import { createApplyBatchExtensionsFunction } from './core/extensions/applyQueryExtensions'
import { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { getBatchId } from './core/jsonProtocol/getBatchId'
import { isWrite } from './core/jsonProtocol/isWrite'
import { GlobalOmitOptions } from './core/jsonProtocol/serializeJsonQuery'
import { PrismaPromiseInteractiveTransaction, PrismaPromiseTransaction } from './core/request/PrismaPromise'
import { Action, JsArgs } from './core/types/exported/JsApi'
import { DataLoader } from './DataLoader'
import type { Client, Unpacker } from './getPrismaClient'
import { CallSite } from './utils/CallSite'
import { createErrorMessageWithContext } from './utils/createErrorMessageWithContext'
import { deepGet } from './utils/deep-set'
import { deserializeRawResult, RawResponse } from './utils/deserializeRawResults'

const debug = Debug('prisma:client:request_handler')
const clientGetTime = typeof process !== 'undefined' && Boolean(process.env.PRISMA_CLIENT_GET_TIME)

type EngineWithPrecomputedCachedResult = Client['_engine'] & {
  requestPrecomputedCachedResult?: <T>(
    query: JsonQuery,
    precomputedQueryPlanCacheHit: PrecomputedQueryPlanCacheHit,
    options: {
      isWrite: boolean
      customDataProxyFetch?: AccelerateExtensionFetchDecorator
    },
  ) => Promise<T>
}

export type RequestParams = {
  modelName?: string
  action: Action
  protocolQuery: JsonQuery
  dataPath: string[]
  clientMethod: string
  callsite?: CallSite
  transaction?: PrismaPromiseTransaction
  extensions: MergedExtensionsList
  args?: any
  headers?: Record<string, string>
  unpacker?: Unpacker
  otelParentCtx?: Context
  otelChildCtx?: Context
  globalOmit?: GlobalOmitOptions
  precomputedQueryPlanCacheHit?: PrecomputedQueryPlanCacheHit
  precomputedBatchId?: string
  customDataProxyFetch?: AccelerateExtensionFetchDecorator
}

export type HandleErrorParams = {
  args: JsArgs
  error: any
  clientMethod: string
  callsite?: CallSite
  transaction?: PrismaPromiseTransaction
  modelName?: string
  globalOmit?: GlobalOmitOptions
}

export class RequestHandler {
  client: Client
  dataloader: DataLoader<RequestParams>
  private logEmitter?: LogEmitter

  constructor(client: Client, logEmitter?: LogEmitter) {
    this.logEmitter = logEmitter
    this.client = client

    this.dataloader = new DataLoader({
      batchLoader: createApplyBatchExtensionsFunction(async ({ requests, customDataProxyFetch }) => {
        const { transaction, otelParentCtx } = requests[0]
        let queries: JsonQuery[]
        let precomputedQueryPlanCacheHits: PrecomputedQueryPlanCacheHit[] | undefined
        let containsWrite: boolean

        if (requests.length === 2) {
          const firstRequest = requests[0]
          const secondRequest = requests[1]
          queries = [firstRequest.protocolQuery, secondRequest.protocolQuery]
          precomputedQueryPlanCacheHits =
            firstRequest.precomputedQueryPlanCacheHit !== undefined &&
            secondRequest.precomputedQueryPlanCacheHit !== undefined
              ? [firstRequest.precomputedQueryPlanCacheHit, secondRequest.precomputedQueryPlanCacheHit]
              : undefined
          containsWrite = isWrite(firstRequest.protocolQuery.action) || isWrite(secondRequest.protocolQuery.action)
        } else {
          queries = requests.map((r) => r.protocolQuery)
          precomputedQueryPlanCacheHits = requests.every((r) => r.precomputedQueryPlanCacheHit !== undefined)
            ? requests.map((r) => r.precomputedQueryPlanCacheHit!)
            : undefined
          containsWrite = requests.some((r) => isWrite(r.protocolQuery.action))
        }
        const traceparent = this.client._tracingHelper.getTraceParent(otelParentCtx)

        // TODO: pass the child information to QE for it to issue links to queries
        // const links = requests.map((r) => trace.getSpanContext(r.otelChildCtx!))

        const results = await this.client._engine.requestBatch(queries, {
          traceparent,
          transaction: getTransactionOptions(transaction),
          containsWrite,
          precomputedQueryPlanCacheHits,
          customDataProxyFetch,
        })

        if (requests.length === 2) {
          const mappedResults = new Array(results.length)
          for (let i = 0; i < results.length; i++) {
            const result = results[i]
            if (result instanceof Error) {
              mappedResults[i] = result
            } else {
              try {
                mappedResults[i] = this.mapQueryEngineResult(requests[i], result)
              } catch (error) {
                mappedResults[i] = error
              }
            }
          }
          return mappedResults
        }

        return results.map((result, i) => {
          if (result instanceof Error) {
            return result
          }

          try {
            return this.mapQueryEngineResult(requests[i], result)
          } catch (error) {
            return error
          }
        })
      }),

      singleLoader: (request) => {
        const precomputedCachedResult = this.trySingleLoaderPrecomputedCachedResult(request)
        if (precomputedCachedResult !== undefined) {
          return precomputedCachedResult
        }

        const interactiveTransaction =
          request.transaction?.kind === 'itx' ? getItxTransactionOptions(request.transaction) : undefined

        try {
          return this.client._engine
            .request(request.protocolQuery, {
              traceparent: this.client._tracingHelper.getTraceParent(),
              interactiveTransaction,
              isWrite: isWrite(request.protocolQuery.action),
              precomputedQueryPlanCacheHit: request.precomputedQueryPlanCacheHit,
              customDataProxyFetch: request.customDataProxyFetch,
            })
            .then((response) => this.mapQueryEngineResult(request, response))
        } catch (error) {
          return Promise.reject(error)
        }
      },

      canBatch: (request) => {
        if (request.transaction?.kind === 'itx') {
          return true
        }

        if (request.transaction?.id) {
          return true
        }

        return request.protocolQuery.action === 'findUnique' || request.protocolQuery.action === 'findUniqueOrThrow'
      },

      batchBy: (request) => {
        // If the request is part of an interactive transaction, we want to group all requests with the same
        // protocolQuery together to take advantage of automatic batching in the engine.
        // Note that we only do this for interactive transactions, not for batch transactions, as it can lead to queries
        // being executed out of order in batch transactions.
        if (request.transaction?.kind === 'itx') {
          const batchId = request.precomputedBatchId ?? getBatchId(request.protocolQuery)
          return `itx-${request.transaction.id}${batchId ? `-${batchId}` : ''}`
        }

        if (request.transaction?.id) {
          return `transaction-${request.transaction.id}`
        }

        return request.precomputedBatchId ?? getBatchId(request.protocolQuery)
      },

      batchOrder(requestA, requestB) {
        if (requestA.transaction?.kind === 'batch' && requestB.transaction?.kind === 'batch') {
          return requestA.transaction.index - requestB.transaction.index
        }
        return 0
      },
    })
  }

  request(params: RequestParams): Promise<any> {
    let requestPromise: Promise<any>

    try {
      requestPromise = this.dataloader.request(params)
    } catch (error) {
      try {
        this.handleRequestErrorForParams(params, error)
      } catch (handledError) {
        return Promise.reject(handledError)
      }
    }

    return requestPromise.then(undefined, (error) => this.handleRequestErrorForParams(params, error))
  }

  requestPrecomputedCachedResult(params: RequestParams): Promise<any> {
    const engine = this.client._engine as EngineWithPrecomputedCachedResult
    if (engine.requestPrecomputedCachedResult === undefined || params.precomputedQueryPlanCacheHit === undefined) {
      return this.request(params)
    }

    try {
      return engine
        .requestPrecomputedCachedResult(params.protocolQuery, params.precomputedQueryPlanCacheHit, {
          isWrite: isWrite(params.protocolQuery.action),
          customDataProxyFetch: params.customDataProxyFetch,
        })
        .then((result) => (clientGetTime ? { data: result } : result))
        .catch((error) => this.handleRequestErrorForParams(params, error))
    } catch (error) {
      this.handleRequestErrorForParams(params, error)
    }
  }

  private trySingleLoaderPrecomputedCachedResult(params: RequestParams): Promise<any> | undefined {
    const engine = this.client._engine as EngineWithPrecomputedCachedResult
    if (
      engine.requestPrecomputedCachedResult === undefined ||
      params.precomputedQueryPlanCacheHit === undefined ||
      params.transaction !== undefined ||
      params.dataPath.length !== 0 ||
      params.unpacker !== undefined
    ) {
      return undefined
    }

    try {
      return engine
        .requestPrecomputedCachedResult(params.protocolQuery, params.precomputedQueryPlanCacheHit, {
          isWrite: isWrite(params.protocolQuery.action),
          customDataProxyFetch: params.customDataProxyFetch,
        })
        .then((result) => (clientGetTime ? { data: result } : result))
        .catch((error) => this.handleRequestErrorForParams(params, error))
    } catch (error) {
      this.handleRequestErrorForParams(params, error)
    }
  }

  private handleRequestErrorForParams(params: RequestParams, error: unknown): never {
    const { clientMethod, callsite, transaction, args, modelName } = params
    this.handleAndLogRequestError({
      error,
      clientMethod,
      callsite,
      transaction,
      args,
      modelName,
      globalOmit: params.globalOmit,
    })
  }

  mapQueryEngineResult({ dataPath, unpacker }: RequestParams, response: QueryEngineResultData<any>) {
    const data = response?.data

    /**
     * Unpack
     */
    const result = this.unpack(data, dataPath, unpacker, response?.[queryEngineResultDataWasDeserialized] === true)
    if (clientGetTime) {
      return { data: result }
    }
    return result
  }

  /**
   * Handles the error and logs it, logging the error is done synchronously waiting for the event
   * handlers to finish.
   */
  handleAndLogRequestError(params: HandleErrorParams): never {
    try {
      this.handleRequestError(params)
    } catch (err) {
      if (this.logEmitter) {
        this.logEmitter.emit('error', { message: err.message, target: params.clientMethod, timestamp: new Date() })
      }
      throw err
    }
  }

  handleRequestError({
    error,
    clientMethod,
    callsite,
    transaction,
    args,
    modelName,
    globalOmit,
  }: HandleErrorParams): never {
    debug(error)

    if (isMismatchingBatchIndex(error, transaction)) {
      // if this is batch error and current request was not it's cause, we don't add
      // context information to the error: this wasn't a request that caused batch to fail
      throw error
    }

    if (error instanceof PrismaClientKnownRequestError && isValidationError(error)) {
      const validationError = convertValidationError(error.meta as EngineValidationError)
      throwValidationException({
        args,
        errors: [validationError],
        callsite,
        errorFormat: this.client._errorFormat,
        originalMethod: clientMethod,
        clientVersion: this.client._clientVersion,
        globalOmit,
      })
    }

    let message = error.message
    if (callsite) {
      message = createErrorMessageWithContext({
        callsite,
        originalMethod: clientMethod,
        isPanic: error.isPanic,
        showColors: this.client._errorFormat === 'pretty',
        message,
      })
    }

    message = this.sanitizeMessage(message)
    // TODO: Do request with callsite instead, so we don't need to rethrow
    if (error.code) {
      const meta = modelName ? { modelName, ...error.meta } : error.meta
      throw new PrismaClientKnownRequestError(message, {
        code: error.code,
        clientVersion: this.client._clientVersion,
        meta,
        batchRequestIdx: error.batchRequestIdx,
      })
    } else if (error.isPanic) {
      throw new PrismaClientRustPanicError(message, this.client._clientVersion)
    } else if (error instanceof PrismaClientUnknownRequestError) {
      throw new PrismaClientUnknownRequestError(message, {
        clientVersion: this.client._clientVersion,
        batchRequestIdx: error.batchRequestIdx,
      })
    } else if (error instanceof PrismaClientInitializationError) {
      throw new PrismaClientInitializationError(message, this.client._clientVersion)
    } else if (error instanceof PrismaClientRustPanicError) {
      throw new PrismaClientRustPanicError(message, this.client._clientVersion)
    }

    error.clientVersion = this.client._clientVersion

    throw error
  }

  sanitizeMessage(message) {
    if (this.client._errorFormat && this.client._errorFormat !== 'pretty') {
      return stripAnsi(message)
    }
    return message
  }

  unpack(data: unknown, dataPath: string[], unpacker?: Unpacker, alreadyDeserialized = false) {
    if (!data) {
      return data
    }
    if (data['data']) {
      data = data['data']
    }

    if (!data) {
      return data
    }
    const operation = Object.keys(data)[0]
    const response = Object.values(data)[0]
    const pathForGet = dataPath.filter((key) => key !== 'select' && key !== 'include')
    const extractedResponse = deepGet(response, pathForGet)
    const deserializedResponse = alreadyDeserialized
      ? extractedResponse
      : operation === 'queryRaw'
        ? deserializeRawResult(extractedResponse as RawResponse)
        : (deserializeJsonObject(extractedResponse) as unknown)

    return unpacker ? unpacker(deserializedResponse) : deserializedResponse
  }

  get [Symbol.toStringTag]() {
    return 'RequestHandler'
  }
}

function getTransactionOptions<PayloadType>(
  transaction?: PrismaPromiseTransaction<PayloadType>,
): TransactionOptions<PayloadType> | undefined {
  if (!transaction) {
    return undefined
  }

  if (transaction.kind === 'batch') {
    return {
      kind: 'batch',
      options: {
        isolationLevel: transaction.isolationLevel,
        maxWait: transaction.maxWait,
        timeout: transaction.timeout,
      },
    }
  }

  if (transaction.kind === 'itx') {
    return {
      kind: 'itx',
      options: getItxTransactionOptions(transaction),
    }
  }

  assertNever(transaction, 'Unknown transaction kind')
}

function getItxTransactionOptions<PayloadType>(
  transaction: PrismaPromiseInteractiveTransaction<PayloadType>,
): InteractiveTransactionOptions<PayloadType> {
  return {
    id: transaction.id,
    payload: transaction.payload,
  }
}

function isMismatchingBatchIndex(error: any, transaction: PrismaPromiseTransaction | undefined) {
  return hasBatchIndex(error) && transaction?.kind === 'batch' && error.batchRequestIdx !== transaction.index
}

function isValidationError(error: PrismaClientKnownRequestError) {
  return (
    error.code === 'P2009' || // validation error
    error.code === 'P2012' // required argument missing
  )
}

/**
 * Engine validation errors include extra segment for selectionPath - root query field.
 * This function removes it (since it does not exist on js arguments). In case of `Union`
 * error type, removes heading element from selectionPath of nested errors as well.
 * @param error
 * @returns
 */
function convertValidationError(error: EngineValidationError): EngineValidationError {
  if (error.kind === 'Union') {
    return {
      kind: 'Union',
      errors: error.errors.map(convertValidationError),
    }
  }

  if (Array.isArray(error['selectionPath'])) {
    const [, ...selectionPath] = error['selectionPath']

    return {
      ...error,
      selectionPath,
    } as EngineValidationError
  }

  return error
}
