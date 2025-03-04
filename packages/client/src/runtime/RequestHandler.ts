import type { Context } from '@opentelemetry/api'
import Debug from '@prisma/debug'
import { assertNever } from '@prisma/internals'
import stripAnsi from 'strip-ansi'

import type {
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
import type { CustomDataProxyFetch } from './core/engines/common/Engine'
import type { QueryEngineResultData } from './core/engines/common/types/QueryEngine'
import { throwValidationException } from './core/errorRendering/throwValidationException'
import { hasBatchIndex } from './core/errors/ErrorWithBatchIndex'
import { createApplyBatchExtensionsFunction } from './core/extensions/applyQueryExtensions'
import type { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { deserializeJsonResponse } from './core/jsonProtocol/deserializeJsonResponse'
import { getBatchId } from './core/jsonProtocol/getBatchId'
import { isWrite } from './core/jsonProtocol/isWrite'
import type { GlobalOmitOptions } from './core/jsonProtocol/serializeJsonQuery'
import type { PrismaPromiseInteractiveTransaction, PrismaPromiseTransaction } from './core/request/PrismaPromise'
import type { Action, JsArgs } from './core/types/exported/JsApi'
import { DataLoader } from './DataLoader'
import type { Client, Unpacker } from './getPrismaClient'
import type { CallSite } from './utils/CallSite'
import { createErrorMessageWithContext } from './utils/createErrorMessageWithContext'
import { deepGet } from './utils/deep-set'
import { deserializeRawResult, type RawResponse } from './utils/deserializeRawResults'

const debug = Debug('prisma:client:request_handler')

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
  customDataProxyFetch?: CustomDataProxyFetch
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
        const queries = requests.map((r) => r.protocolQuery)
        const traceparent = this.client._tracingHelper.getTraceParent(otelParentCtx)

        // TODO: pass the child information to QE for it to issue links to queries
        // const links = requests.map((r) => trace.getSpanContext(r.otelChildCtx!))

        const containsWrite = requests.some((r) => isWrite(r.protocolQuery.action))

        const results = await this.client._engine.requestBatch(queries, {
          traceparent,
          transaction: getTransactionOptions(transaction),
          containsWrite,
          customDataProxyFetch,
        })

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

      singleLoader: async (request) => {
        const interactiveTransaction =
          request.transaction?.kind === 'itx' ? getItxTransactionOptions(request.transaction) : undefined

        const response = await this.client._engine.request(request.protocolQuery, {
          traceparent: this.client._tracingHelper.getTraceParent(),
          interactiveTransaction,
          isWrite: isWrite(request.protocolQuery.action),
          customDataProxyFetch: request.customDataProxyFetch,
        })
        return this.mapQueryEngineResult(request, response)
      },

      batchBy: (request) => {
        if (request.transaction?.id) {
          return `transaction-${request.transaction.id}`
        }

        return getBatchId(request.protocolQuery)
      },

      batchOrder(requestA, requestB) {
        if (requestA.transaction?.kind === 'batch' && requestB.transaction?.kind === 'batch') {
          return requestA.transaction.index - requestB.transaction.index
        }
        return 0
      },
    })
  }

  async request(params: RequestParams) {
    try {
      return await this.dataloader.request(params)
    } catch (error) {
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
  }

  mapQueryEngineResult({ dataPath, unpacker }: RequestParams, response: QueryEngineResultData<any>) {
    const data = response?.data

    /**
     * Unpack
     */
    const result = this.unpack(data, dataPath, unpacker)
    if (process.env.PRISMA_CLIENT_GET_TIME) {
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
    }if (error.isPanic) {
      throw new PrismaClientRustPanicError(message, this.client._clientVersion)
    }if (error instanceof PrismaClientUnknownRequestError) {
      throw new PrismaClientUnknownRequestError(message, {
        clientVersion: this.client._clientVersion,
        batchRequestIdx: error.batchRequestIdx,
      })
    }if (error instanceof PrismaClientInitializationError) {
      throw new PrismaClientInitializationError(message, this.client._clientVersion)
    }if (error instanceof PrismaClientRustPanicError) {
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

  unpack(data: unknown, dataPath: string[], unpacker?: Unpacker) {
    if (!data) {
      return data
    }
    if (data.data) {
      data = data.data
    }

    if (!data) {
      return data
    }
    const operation = Object.keys(data)[0]
    const response = Object.values(data)[0]
    const pathForGet = dataPath.filter((key) => key !== 'select' && key !== 'include')
    const extractedResponse = deepGet(response, pathForGet)
    const deserializedResponse =
      operation === 'queryRaw'
        ? deserializeRawResult(extractedResponse as RawResponse)
        : (deserializeJsonResponse(extractedResponse) as unknown)

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

  if (Array.isArray(error.selectionPath)) {
    const [, ...selectionPath] = error.selectionPath

    return {
      ...error,
      selectionPath,
    } as EngineValidationError
  }

  return error
}
