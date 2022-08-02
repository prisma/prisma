import { Context, trace } from '@opentelemetry/api'
import Debug from '@prisma/debug'
import { getTraceParent } from '@prisma/engine-core'
import stripAnsi from 'strip-ansi'

import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '.'
import { DataLoader } from './DataLoader'
import type { Client, Unpacker } from './getPrismaClient'
import type { EngineMiddleware } from './MiddlewareHandler'
import type { Document } from './query'
import { Args, unpack } from './query'
import { printStack } from './utils/printStack'
import type { RejectOnNotFound } from './utils/rejectOnNotFound'
import { throwIfNotFound } from './utils/rejectOnNotFound'

const debug = Debug('prisma:client:request_handler')

export type RequestParams = {
  document: Document
  dataPath: string[]
  rootField: string
  typeName: string
  isList: boolean
  clientMethod: string
  callsite?: string
  rejectOnNotFound?: RejectOnNotFound
  runInTransaction?: boolean
  engineHook?: EngineMiddleware
  args: any
  headers?: Record<string, string>
  transactionId?: string | number
  unpacker?: Unpacker
  otelParentCtx?: Context
  otelChildCtx?: Context
}

export type HandleErrorParams = {
  error: any
  clientMethod: string
  callsite?: string
}

export type Request = {
  document: Document
  runInTransaction?: boolean
  transactionId?: string | number
  headers?: Record<string, string>
  otelParentCtx?: Context
  otelChildCtx?: Context
}

function getRequestInfo(request: Request) {
  const txId = request.transactionId
  const inTx = request.runInTransaction
  const headers = request.headers ?? {}
  const traceparent = getTraceParent()

  // if the tx has a number for an id, then it's a regular batch tx
  const _inTx = typeof txId === 'number' && inTx ? true : undefined
  // if the tx has a string for id, it's an interactive transaction
  const _txId = typeof txId === 'string' && inTx ? txId : undefined

  if (_txId !== undefined) headers.transactionId = _txId
  if (traceparent !== undefined) headers.traceparent = traceparent

  return { inTx: _inTx, headers }
}

export class RequestHandler {
  client: Client
  hooks: any
  dataloader: DataLoader<Request>

  constructor(client: Client, hooks?: any) {
    this.client = client
    this.hooks = hooks
    this.dataloader = new DataLoader({
      batchLoader: (requests) => {
        const info = getRequestInfo(requests[0])
        const queries = requests.map((r) => String(r.document))
        const traceparent = getTraceParent(requests[0].otelParentCtx)

        if (traceparent) info.headers.traceparent = traceparent
        // TODO: pass the child information to QE for it to issue links to queries
        // const links = requests.map((r) => trace.getSpanContext(r.otelChildCtx!))

        return this.client._engine.requestBatch(queries, info.headers, info.inTx)
      },
      singleLoader: (request) => {
        const info = getRequestInfo(request)
        const query = String(request.document)

        return this.client._engine.request(query, info.headers)
      },
      batchBy: (request) => {
        if (request.transactionId) {
          return `transaction-${request.transactionId}`
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
    runInTransaction,
    engineHook,
    args,
    headers,
    transactionId,
    unpacker,
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
            runInTransaction,
          },
          (params) => this.dataloader.request(params),
        )
        data = result.data
        elapsed = result.elapsed
      } else {
        const result = await this.dataloader.request({
          document,
          runInTransaction,
          headers,
          transactionId,
          otelParentCtx,
          otelChildCtx,
        })
        data = result?.data
        elapsed = result?.elapsed
      }

      /**
       * Unpack
       */
      const unpackResult = this.unpack(document, data, dataPath, rootField, unpacker)
      throwIfNotFound(unpackResult, clientMethod, typeName, rejectOnNotFound)
      if (process.env.PRISMA_CLIENT_GET_TIME) {
        return { data: unpackResult, elapsed }
      }
      return unpackResult
    } catch (error) {
      this.handleRequestError({ error, clientMethod, callsite })
    }
  }

  handleRequestError({ error, clientMethod, callsite }: HandleErrorParams): never {
    debug(error)

    let message = error.message
    if (callsite) {
      const { stack } = printStack({
        callsite,
        originalMethod: clientMethod,
        onUs: error.isPanic,
        showColors: this.client._errorFormat === 'pretty',
      })
      message = `${stack}\n  ${error.message}`
    }

    message = this.sanitizeMessage(message)
    // TODO: Do request with callsite instead, so we don't need to rethrow
    if (error.code) {
      throw new PrismaClientKnownRequestError(message, error.code, this.client._clientVersion, error.meta)
    } else if (error.isPanic) {
      throw new PrismaClientRustPanicError(message, this.client._clientVersion)
    } else if (error instanceof PrismaClientUnknownRequestError) {
      throw new PrismaClientUnknownRequestError(message, this.client._clientVersion)
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

  get [Symbol.toStringTag]() {
    return 'RequestHandler'
  }
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

  // queries that share this token will be batched and collapsed alltogether
  return `${request.document.children[0].name}|${args}|${selectionSet}`
  // this way, the query engine will be able to collapse into a single call
  // and that is because all the queries share their `where` and `includes`
}
