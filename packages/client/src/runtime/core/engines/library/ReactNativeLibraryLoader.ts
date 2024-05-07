/* eslint-disable @typescript-eslint/require-await */

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { QueryEngineConfig } from '../common/types/QueryEngine'
import { LibraryLoader, QueryEngineInstance } from './types/Library'

type PrismaCreateOptions = {
  datamodel: string
  logLevel: string
  logQueries: boolean
  logCallback: (msg: string) => void
  ignoreEnvVarErrors: boolean
  datasourceOverrides: object | string
  env: object | string
}

type QueryEngineObject = object

declare const __PrismaProxy: {
  create: (options: PrismaCreateOptions) => QueryEngineObject
  connect: (engine: QueryEngineObject, trace: string) => void
  execute: (engine: QueryEngineObject, body: string, headers: string, txId?: string) => Promise<string>
  startTransaction: (engine: QueryEngineObject, body: string, headers: string) => string
  commitTransaction: (engine: QueryEngineObject, txId: string, headers: string) => string
  rollbackTransaction: (engine: QueryEngineObject, txId: string, headers: string) => string
  disconnect: (engine: QueryEngineObject, headers: string) => void
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
    })
  }

  async connect(headers: string): Promise<void> {
    return __PrismaProxy.connect(this.engineObject, headers)
  }

  async disconnect(headers: string): Promise<void> {
    return __PrismaProxy.disconnect(this.engineObject, headers)
  }

  query(requestStr: string, headersStr: string, transactionId?: string): Promise<string> {
    return __PrismaProxy.execute(this.engineObject, requestStr, headersStr, transactionId)
  }

  sdlSchema(): Promise<string> {
    return Promise.resolve('{}')
  }

  dmmf(_traceparent: string): Promise<string> {
    return Promise.resolve('{}')
  }

  async startTransaction(options: string, traceHeaders: string): Promise<string> {
    return __PrismaProxy.startTransaction(this.engineObject, options, traceHeaders)
  }

  async commitTransaction(id: string, traceHeaders: string): Promise<string> {
    return __PrismaProxy.commitTransaction(this.engineObject, id, traceHeaders)
  }

  async rollbackTransaction(id: string, traceHeaders: string): Promise<string> {
    return __PrismaProxy.rollbackTransaction(this.engineObject, id, traceHeaders)
  }

  metrics(_options: string): Promise<string> {
    return Promise.resolve('{}')
  }

  async applyPendingMigrations(): Promise<void> {
    return __PrismaProxy.applyPendingMigrations(this.engineObject)
  }
}

// unlike other implementations, on react-native the library needs to be loaded
// before the engine can be created, so this loader just checks the bindings are there
// and returns a dummy constructor that just wraps the methods so that the libraryEngine remains agnosti
export const reactNativeLibraryLoader: LibraryLoader = {
  // eslint-disable-next-line @typescript-eslint/require-await
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
