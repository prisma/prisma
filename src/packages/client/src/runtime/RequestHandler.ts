import Debug from '@prisma/debug'
import stripAnsi from 'strip-ansi'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '.'
import { DataLoader } from './DataLoader'
import { Client, Unpacker } from './getPrismaClient'
import { EngineMiddleware } from './MiddlewareHandler'
import { Document, unpack } from './query'
import { printStack } from './utils/printStack'
import { RejectOnNotFound, throwIfNotFound } from './utils/rejectOnNotFound'
const debug = Debug('prisma:client:fetcher')

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
  showColors?: boolean
  engineHook?: EngineMiddleware
  args: any
  headers?: Record<string, string>
  transactionId?: string
  unpacker?: Unpacker
}

export type Request = {
  document: Document
  runInTransaction?: boolean
  transactionId?: string
  headers?: Record<string, string>
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
        const headers = {transactionId: requests[0].transactionId}
        const queries = requests.map((r) => String(r.document))

        return this.client._engine.requestBatch(queries, headers)
      },
      singleLoader: (request) => {
        const query = String(request.document)

        return this.client._engine.request(query, request.headers)
      },
      batchBy: (request) => {
        return `${request.transactionId}` ?? 'batch'
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
    showColors,
    engineHook,
    args,
    headers,
    transactionId,
    unpacker,
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
        })
        data = result?.data
        elapsed = result?.elapsed
      }

      /**
       * Unpack
       */
      const unpackResult = this.unpack(
        document,
        data,
        dataPath,
        rootField,
        unpacker,
      )
      throwIfNotFound(unpackResult, clientMethod, typeName, rejectOnNotFound)
      if (process.env.PRISMA_CLIENT_GET_TIME) {
        return { data: unpackResult, elapsed }
      }
      return unpackResult
    } catch (e) {
      debug(e)
      let message = e.message
      if (callsite) {
        const { stack } = printStack({
          callsite,
          originalMethod: clientMethod,
          onUs: e.isPanic,
          showColors,
        })
        message = `${stack}\n  ${e.message}`
      }

      message = this.sanitizeMessage(message)
      // TODO: Do request with callsite instead, so we don't need to rethrow
      if (e.code) {
        throw new PrismaClientKnownRequestError(
          message,
          e.code,
          this.client._clientVersion,
          e.meta,
        )
      } else if (e.isPanic) {
        throw new PrismaClientRustPanicError(
          message,
          this.client._clientVersion,
        )
      } else if (e instanceof PrismaClientUnknownRequestError) {
        throw new PrismaClientUnknownRequestError(
          message,
          this.client._clientVersion,
        )
      } else if (e instanceof PrismaClientInitializationError) {
        throw new PrismaClientInitializationError(
          message,
          this.client._clientVersion,
        )
      } else if (e instanceof PrismaClientRustPanicError) {
        throw new PrismaClientRustPanicError(
          message,
          this.client._clientVersion,
        )
      }

      e.clientVersion = this.client._clientVersion

      throw e
    }
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
