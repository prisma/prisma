import { Context } from '@opentelemetry/api'
import Debug from '@prisma/debug'
import {
  EventEmitter,
  getTraceParent,
  hasBatchIndex,
  InteractiveTransactionOptions,
  TracingConfig,
  TransactionOptions,
} from '@prisma/engine-core'
import { Fetch } from '@prisma/engine-core/dist/data-proxy/utils/request'
import { assertNever } from '@prisma/internals'
import stripAnsi from 'strip-ansi'

import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '.'
import { applyResultExtensions } from './core/extensions/applyResultExtensions'
import { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { visitQueryResult } from './core/extensions/visitQueryResult'
import { dmmfToJSModelName } from './core/model/utils/dmmfToJSModelName'
import { ProtocolMessage } from './core/protocol/common'
import { PrismaPromiseInteractiveTransaction, PrismaPromiseTransaction } from './core/request/PrismaPromise'
import { JsArgs } from './core/types/JsApi'
import { DataLoader } from './DataLoader'
import type { Client, Unpacker } from './getPrismaClient'
import { CallSite } from './utils/CallSite'
import { createErrorMessageWithContext } from './utils/createErrorMessageWithContext'
import { NotFoundError, RejectOnNotFound, throwIfNotFound } from './utils/rejectOnNotFound'

const debug = Debug('prisma:client:request_handler')

export type RequestParams = {
  modelName?: string
  protocolMessage: ProtocolMessage
  dataPath: string[]
  clientMethod: string
  callsite?: CallSite
  rejectOnNotFound?: RejectOnNotFound
  transaction?: PrismaPromiseTransaction
  extensions: MergedExtensionsList
  args?: any
  headers?: Record<string, string>
  unpacker?: Unpacker
  otelParentCtx?: Context
  otelChildCtx?: Context
  customFetch?: (fetch: Fetch) => Fetch
}

export type HandleErrorParams = {
  error: any
  clientMethod: string
  callsite?: CallSite
  transaction?: PrismaPromiseTransaction
}

export type Request = {
  protocolMessage: ProtocolMessage
  transaction?: PrismaPromiseTransaction
  otelParentCtx?: Context
  otelChildCtx?: Context
  tracingConfig?: TracingConfig
  customFetch?: (fetch: Fetch) => Fetch
}

type ApplyExtensionsParams = {
  result: object
  modelName: string
  args: JsArgs
  extensions: MergedExtensionsList
}

export class RequestHandler {
  client: Client
  dataloader: DataLoader<Request>
  private logEmmitter?: EventEmitter

  constructor(client: Client, logEmitter?: EventEmitter) {
    this.logEmmitter = logEmitter
    this.client = client
    this.dataloader = new DataLoader({
      batchLoader: (requests) => {
        const transaction = requests[0].transaction
        const queries = requests.map((r) => r.protocolMessage.toEngineQuery())
        const traceparent = getTraceParent({ context: requests[0].otelParentCtx, tracingConfig: client._tracingConfig })

        // TODO: pass the child information to QE for it to issue links to queries
        // const links = requests.map((r) => trace.getSpanContext(r.otelChildCtx!))

        const containsWrite = requests.some((r) => r.protocolMessage.isWrite())

        return this.client._engine.requestBatch(queries, {
          traceparent,
          transaction: getTransactionOptions(transaction),
          containsWrite,
          customFetch: requests[0].customFetch,
        })
      },
      singleLoader: (request) => {
        const interactiveTransaction =
          request.transaction?.kind === 'itx' ? getItxTransactionOptions(request.transaction) : undefined

        return this.client._engine.request(request.protocolMessage.toEngineQuery(), {
          traceparent: getTraceParent({ tracingConfig: request.tracingConfig }),
          interactiveTransaction,
          isWrite: request.protocolMessage.isWrite(),
          customFetch: request.customFetch,
        })
      },
      batchBy: (request) => {
        if (request.transaction?.id) {
          return `transaction-${request.transaction.id}`
        }

        return request.protocolMessage.getBatchId()
      },
    })
  }

  async request({
    protocolMessage,
    dataPath = [],
    callsite,
    modelName,
    rejectOnNotFound,
    clientMethod,
    args,
    transaction,
    unpacker,
    extensions,
    otelParentCtx,
    otelChildCtx,
    customFetch,
  }: RequestParams) {
    try {
      const response = await this.dataloader.request({
        protocolMessage,
        transaction,
        otelParentCtx,
        otelChildCtx,
        tracingConfig: this.client._tracingConfig,
        customFetch,
      })
      const data = response?.data
      const elapsed = response?.elapsed

      /**
       * Unpack
       */
      let result = this.unpack(protocolMessage, data, dataPath, unpacker)
      throwIfNotFound(result, clientMethod, modelName, rejectOnNotFound)
      if (modelName) {
        result = this.applyResultExtensions({ result, modelName, args, extensions })
      }
      if (process.env.PRISMA_CLIENT_GET_TIME) {
        return { data: result, elapsed }
      }
      return result
    } catch (error) {
      this.handleAndLogRequestError({ error, clientMethod, callsite, transaction })
    }
  }

  /**
   * Handles the error and logs it, logging the error is done synchronously waiting for the event
   * handlers to finish.
   */
  handleAndLogRequestError({ error, clientMethod, callsite, transaction }: HandleErrorParams): never {
    try {
      this.handleRequestError({ error, clientMethod, callsite, transaction })
    } catch (err) {
      if (this.logEmmitter) {
        this.logEmmitter.emit('error', { message: err.message, target: clientMethod, timestamp: new Date() })
      }
      throw err
    }
  }

  handleRequestError({ error, clientMethod, callsite, transaction }: HandleErrorParams): never {
    debug(error)

    if (isMismatchingBatchIndex(error, transaction)) {
      // if this is batch error and current request was not it's cause, we don't add
      // context information to the error: this wasn't a request that caused batch to fail
      throw error
    }

    if (error instanceof NotFoundError) {
      // TODO: This is a workaround to keep backwards compatibility with clients
      // consuming NotFoundError
      throw error
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
      throw new PrismaClientKnownRequestError(message, {
        code: error.code,
        clientVersion: this.client._clientVersion,
        meta: error.meta,
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

  unpack(message: ProtocolMessage, data: unknown, dataPath: string[], unpacker?: Unpacker) {
    if (!data) {
      return data
    }
    if (data['data']) {
      data = data['data']
    }

    const deserializeResponse = message.deserializeResponse(data, dataPath)
    return unpacker ? unpacker(deserializeResponse) : deserializeResponse
  }

  applyResultExtensions({ result, modelName, args, extensions }: ApplyExtensionsParams) {
    if (extensions.isEmpty() || result == null) {
      return result
    }
    const model = this.client._baseDmmf.getModelMap()[modelName]
    if (!model) {
      return result
    }
    return visitQueryResult({
      result,
      args: args ?? {},
      model,
      dmmf: this.client._baseDmmf,
      visitor(value, model, args) {
        const modelName = dmmfToJSModelName(model.name)
        return applyResultExtensions({ result: value, modelName, select: args.select, extensions })
      },
    })
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
