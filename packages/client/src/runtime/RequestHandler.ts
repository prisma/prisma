import { Context } from '@opentelemetry/api'
import Debug from '@prisma/debug'
import { EventEmitter, getTraceParent, hasBatchIndex, TracingConfig } from '@prisma/engine-core'
import stripAnsi from 'strip-ansi'

import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '.'
import { Args as ExtensionArgs } from './core/extensions/$extends'
import { applyResultExtensions } from './core/extensions/applyResultExtensions'
import { MergedExtensionsList } from './core/extensions/MergedExtensionsList'
import { IncludeSelect, visitQueryResult } from './core/extensions/visitQueryResult'
import { dmmfToJSModelName } from './core/model/utils/dmmfToJSModelName'
import { PrismaPromiseTransaction } from './core/request/PrismaPromise'
import { DataLoader } from './DataLoader'
import type { Client, LogEvent, Unpacker } from './getPrismaClient'
import type { EngineMiddleware } from './MiddlewareHandler'
import type { Document } from './query'
import { Args, unpack } from './query'
import { CallSite } from './utils/CallSite'
import { createErrorMessageWithContext } from './utils/createErrorMessageWithContext'
import { NotFoundError, RejectOnNotFound, throwIfNotFound } from './utils/rejectOnNotFound'

const debug = Debug('prisma:client:request_handler')

export type RequestParams = {
  document: Document
  dataPath: string[]
  rootField: string
  typeName: string
  isList: boolean
  clientMethod: string
  callsite?: CallSite
  rejectOnNotFound?: RejectOnNotFound
  transaction?: PrismaPromiseTransaction
  engineHook?: EngineMiddleware
  extensions: MergedExtensionsList
  args?: any
  headers?: Record<string, string>
  unpacker?: Unpacker
  otelParentCtx?: Context
  otelChildCtx?: Context
}

export type HandleErrorParams = {
  error: any
  clientMethod: string
  callsite?: CallSite
  transaction?: PrismaPromiseTransaction
}

export type Request = {
  document: Document
  transaction?: PrismaPromiseTransaction
  headers?: Record<string, string>
  otelParentCtx?: Context
  otelChildCtx?: Context
  tracingConfig?: TracingConfig
}

type ApplyExtensionsParams = {
  result: object
  modelName: string
  args: IncludeSelect
  extensions: MergedExtensionsList
}

function getRequestInfo(request: Request) {
  const transaction = request.transaction
  const headers = request.headers ?? {}
  const traceparent = getTraceParent({ tracingConfig: request.tracingConfig })

  if (transaction?.kind === 'itx') {
    headers.transactionId = transaction.id
  }

  if (traceparent !== undefined) {
    headers.traceparent = traceparent
  }

  return {
    transaction,
    headers,
  }
}

export class RequestHandler {
  client: Client
  hooks: any
  dataloader: DataLoader<Request>
  private logEmmitter?: EventEmitter

  constructor(client: Client, hooks?: any, logEmitter?: EventEmitter) {
    this.logEmmitter = logEmitter
    this.client = client
    this.hooks = hooks
    this.dataloader = new DataLoader({
      batchLoader: (requests) => {
        const info = getRequestInfo(requests[0])
        const queries = requests.map((r) => String(r.document))
        const traceparent = getTraceParent({ context: requests[0].otelParentCtx, tracingConfig: client._tracingConfig })

        if (traceparent) info.headers.traceparent = traceparent
        // TODO: pass the child information to QE for it to issue links to queries
        // const links = requests.map((r) => trace.getSpanContext(r.otelChildCtx!))

        const containsWrite = requests.some((r) => r.document.type === 'mutation')

        const batchTransaction = info.transaction?.kind === 'batch' ? info.transaction : undefined

        return this.client._engine.requestBatch({
          queries,
          headers: info.headers,
          transaction: batchTransaction,
          containsWrite,
        })
      },
      singleLoader: (request) => {
        const info = getRequestInfo(request)
        const query = String(request.document)
        const interactiveTransaction = info.transaction?.kind === 'itx' ? info.transaction : undefined

        return this.client._engine.request({
          query,
          headers: info.headers,
          transaction: interactiveTransaction,
          isWrite: request.document.type === 'mutation',
        })
      },
      batchBy: (request) => {
        if (request.transaction?.id) {
          return `transaction-${request.transaction.id}`
        }

        return batchFindUniqueBy(request)
      },
    })
  }

  async request({
    document,
    dataPath = [],
    rootField,
    typeName,
    isList,
    callsite,
    rejectOnNotFound,
    clientMethod,
    engineHook,
    args,
    headers,
    transaction,
    unpacker,
    extensions,
    otelParentCtx,
    otelChildCtx,
  }: RequestParams) {
    if (this.hooks && this.hooks.beforeRequest) {
      const query = String(document)
      this.hooks.beforeRequest({
        query,
        path: dataPath,
        rootField,
        typeName,
        document,
        isList,
        clientMethod,
        args,
      })
    }
    try {
      /**
       * If there's an engine hook, use it here
       */
      let data, elapsed
      if (engineHook) {
        const result = await engineHook(
          {
            document,
            runInTransaction: Boolean(transaction),
          },
          (params) => {
            return this.dataloader.request({ ...params, tracingConfig: this.client._tracingConfig })
          },
        )
        data = result.data
        elapsed = result.elapsed
      } else {
        const result = await this.dataloader.request({
          document,
          headers,
          transaction,
          otelParentCtx,
          otelChildCtx,
          tracingConfig: this.client._tracingConfig,
        })
        data = result?.data
        elapsed = result?.elapsed
      }

      /**
       * Unpack
       */
      const unpackResult = this.unpack(document, data, dataPath, rootField, unpacker)
      throwIfNotFound(unpackResult, clientMethod, typeName, rejectOnNotFound)
      const extendedResult = this.applyResultExtensions({ result: unpackResult, modelName: typeName, args, extensions })
      if (process.env.PRISMA_CLIENT_GET_TIME) {
        return { data: extendedResult, elapsed }
      }
      return extendedResult
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
  unpack(document, data, path, rootField, unpacker?: Unpacker) {
    if (data?.data) {
      data = data.data
    }
    // to lift up _all in count
    if (unpacker) {
      data[rootField] = unpacker(data[rootField])
    }

    const getPath: any[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter((p) => p !== 'select' && p !== 'include'))
    return unpack({ document, data, path: getPath })
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

function isMismatchingBatchIndex(error: any, transaction: PrismaPromiseTransaction | undefined) {
  return hasBatchIndex(error) && transaction?.kind === 'batch' && error.batchRequestIdx !== transaction.index
}

/**
 * Determines which `findUnique` queries can be batched together so that the
 * query engine can collapse/optimize the queries into a single one. This is
 * especially useful for GQL to generate more efficient queries.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance
 * @param request
 * @returns
 */
function batchFindUniqueBy(request: Request) {
  // if it's not a findUnique query then we don't attempt optimizing
  if (!request.document.children[0].name.startsWith('findUnique')) {
    return undefined
  }

  // we generate a string for the fields we have used in the `where`
  const args = request.document.children[0].args?.args
    .map((a) => {
      if (a.value instanceof Args) {
        return `${a.key}-${a.value.args.map((a) => a.key).join(',')}`
      }
      return a.key
    })
    .join(',')

  // we generate a string for the fields we have used in the `includes`
  const selectionSet = request.document.children[0].children!.join(',')

  // queries that share this token will be batched and collapsed altogether
  return `${request.document.children[0].name}|${args}|${selectionSet}`
  // this way, the query engine will be able to collapse into a single call
  // and that is because all the queries share their `where` and `includes`
}
