/* eslint-disable @typescript-eslint/require-await */

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import type { QueryEngineConfig } from '../common/types/QueryEngine'
import type { LibraryLoader, QueryEngineInstance } from './types/Library'

type PrismaCreateOptions = {
  datamodel: string
  logLevel: string
  logQueries: boolean
  logCallback: (msg: string) => void
  ignoreEnvVarErrors: boolean
  datasourceOverrides: object | string
  env: object | string
  enableTracing: boolean
}

type QueryEngineObject = object

declare const __PrismaProxy: {
  create: (options: PrismaCreateOptions) => QueryEngineObject
  connect: (engine: QueryEngineObject, trace: string, requestId: string) => void
  execute: (
    engine: QueryEngineObject,
    body: string,
    headers: string,
    txId: string | undefined,
    requestId: string,
  ) => Promise<string>
  startTransaction: (engine: QueryEngineObject, body: string, headers: string, requestId: string) => string
  commitTransaction: (engine: QueryEngineObject, txId: string, headers: string, requestId: string) => string
  rollbackTransaction: (engine: QueryEngineObject, txId: string, headers: string, requestId: string) => string
  disconnect: (engine: QueryEngineObject, headers: string, requestId: string) => void
  trace: (engine: QueryEngineObject, requestId: string) => Promise<string | null>
  pushSchema: (engine: QueryEngineObject, schema: string) => void
  applyPendingMigrations: (engine: QueryEngineObject) => void
}

class ReactNativeQueryEngine implements QueryEngineInstance {
  private engineObject: QueryEngineObject
  constructor(config: QueryEngineConfig, logger: (log: string) => void, _adapter?: any) {
    this.engineObject = __PrismaProxy.create({
      datamodel: config.datamodel,
      env: process.env,
      ignoreEnvVarErrors: true,
      datasourceOverrides: config.datasourceOverrides ?? {},
      logLevel: config.logLevel,
      logQueries: config.logQueries ?? false,
      logCallback: logger,
      enableTracing: config.enableTracing,
    })
  }

  async connect(headers: string, requestId: string): Promise<void> {
    return __PrismaProxy.connect(this.engineObject, headers, requestId)
  }

  async disconnect(headers: string, requestId: string): Promise<void> {
    return __PrismaProxy.disconnect(this.engineObject, headers, requestId)
  }

  query(requestStr: string, headersStr: string, transactionId: string | undefined, requestId: string): Promise<string> {
    return __PrismaProxy.execute(this.engineObject, requestStr, headersStr, transactionId, requestId)
  }

  compile(): Promise<string> {
    throw new Error('not implemented')
  }

  sdlSchema(): Promise<string> {
    return Promise.resolve('{}')
  }

  dmmf(_traceparent: string): Promise<string> {
    return Promise.resolve('{}')
  }

  async startTransaction(options: string, traceHeaders: string, requestId: string): Promise<string> {
    return __PrismaProxy.startTransaction(this.engineObject, options, traceHeaders, requestId)
  }

  async commitTransaction(id: string, traceHeaders: string, requestId: string): Promise<string> {
    return __PrismaProxy.commitTransaction(this.engineObject, id, traceHeaders, requestId)
  }

  async rollbackTransaction(id: string, traceHeaders: string, requestId: string): Promise<string> {
    return __PrismaProxy.rollbackTransaction(this.engineObject, id, traceHeaders, requestId)
  }

  metrics(_options: string): Promise<string> {
    return Promise.resolve('{}')
  }

  async applyPendingMigrations(): Promise<void> {
    return __PrismaProxy.applyPendingMigrations(this.engineObject)
  }

  trace(requestId: string): Promise<string | null> {
    return __PrismaProxy.trace(this.engineObject, requestId)
  }
}

// unlike other implementations, on react-native the library needs to be loaded
// before the engine can be created, so this loader just checks the bindings are there
// and returns a dummy constructor that just wraps the methods so that the libraryEngine remains agnosti
export const reactNativeLibraryLoader: LibraryLoader = {
  async loadLibrary(config) {
    if (!__PrismaProxy) {
      throw new PrismaClientInitializationError(
        '__PrismaProxy not detected make sure React Native bindings are installed',
        config.clientVersion!,
      )
    }

    return {
      debugPanic() {
        return Promise.reject('{}') // not used
      },
      dmmf() {
        return Promise.resolve('{}') // not used
      },
      version() {
        return { commit: 'unknown', version: 'unknown' } // not used
      },
      QueryEngine: ReactNativeQueryEngine,
    }
  },
}
