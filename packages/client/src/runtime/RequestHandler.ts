import { Context } from '@opentelemetry/api'
import Debug from '@prisma/debug'
import { assertNever } from '@prisma/internals'
import stripAnsi from 'strip-ansi'

import {
  EngineValidationError,
  EventEmitter,
  Fetch,
  InteractiveTransactionOptions,
  TransactionOptions,
} from '../runtime/core/engines'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '.'
import { throwValidationException } from './core/errorRendering/throwValidationException'
import { hasBatchIndex } from './core/errors/ErrorWithBatchIndex'
import { applyResultExtensions } from './core/extensions/applyResultExtensions'
import { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { visitQueryResult } from './core/extensions/visitQueryResult'
import { dmmfToJSModelName } from './core/model/utils/dmmfToJSModelName'
import { ProtocolEncoder, ProtocolMessage } from './core/protocol/common'
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
  protocolEncoder: ProtocolEncoder
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
  customDataProxyFetch?: (fetch: Fetch) => Fetch
}

export type HandleErrorParams = {
  args: JsArgs
  error: any
  clientMethod: string
  callsite?: CallSite
  transaction?: PrismaPromiseTransaction
}

export type Request = {
  protocolMessage: ProtocolMessage
  protocolEncoder: ProtocolEncoder
  transaction?: PrismaPromiseTransaction
  otelParentCtx?: Context
  otelChildCtx?: Context
  customDataProxyFetch?: (fetch: Fetch) => Fetch
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
  private logEmitter?: EventEmitter

  constructor(client: Client, logEmitter?: EventEmitter) {
    this.logEmitter = logEmitter
    this.client = client
    this.dataloader = new DataLoader({
      batchLoader: (requests) => {
        const { transaction, protocolEncoder, otelParentCtx } = requests[0]
        const queries = protocolEncoder.createBatch(requests.map((r) => r.protocolMessage))
        const traceparent = this.client._tracingHelper.getTraceParent(otelParentCtx)

        // TODO: pass the child information to QE for it to issue links to queries
        // const links = requests.map((r) => trace.getSpanContext(r.otelChildCtx!))

        const containsWrite = requests.some((r) => r.protocolMessage.isWrite())

        return this.client._engine.requestBatch(queries, {
          traceparent,
          transaction: getTransactionOptions(transaction),
          containsWrite,
          customDataProxyFetch: requests[0].customDataProxyFetch,
        })
      },
      singleLoader: (request) => {
        const interactiveTransaction =
          request.transaction?.kind === 'itx' ? getItxTransactionOptions(request.transaction) : undefined

        return this.client._engine.request(request.protocolMessage.toEngineQuery(), {
          traceparent: this.client._tracingHelper.getTraceParent(),
          interactiveTransaction,
          isWrite: request.protocolMessage.isWrite(),
          customDataProxyFetch: request.customDataProxyFetch,
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
    protocolEncoder,
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
    customDataProxyFetch,
  }: RequestParams) {
    try {
      const response = await this.dataloader.request({
        protocolMessage,
        protocolEncoder,
        transaction,
        otelParentCtx,
        otelChildCtx,
        customDataProxyFetch,
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
      this.handleAndLogRequestError({ error, clientMethod, callsite, transaction, args })
    }
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

  handleRequestError({ error, clientMethod, callsite, transaction, args }: HandleErrorParams): never {
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

    if (error instanceof PrismaClientKnownRequestError && isValidationError(error)) {
      const validationError = convertValidationError(error.meta as EngineValidationError)
      throwValidationException({
        args,
        errors: [validationError],
        callsite,
        errorFormat: this.client._errorFormat,
        originalMethod: clientMethod,
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
    const model = this.client._runtimeDataModel.models[modelName]
    if (!model) {
      return result
    }
    return visitQueryResult({
      result,
      args: args ?? {},
      modelName,
      runtimeDataModel: this.client._runtimeDataModel,
      visitor(value, dmmfModelName, args) {
        const modelName = dmmfToJSModelName(dmmfModelName)
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
