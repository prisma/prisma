import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'

import type { EngineConfig } from '../../common/Engine'
import type { QueryEngineConfig } from '../../common/types/QueryEngine'

export type QueryEngineInstance = {
  connect(headers: string, requestId: string): Promise<void>
  disconnect(headers: string, requestId: string): Promise<void>
  /**
   * @param requestStr JSON.stringified `QueryEngineRequest | QueryEngineBatchRequest`
   * @param headersStr JSON.stringified `QueryEngineRequestHeaders`
   */
  query(requestStr: string, headersStr: string, transactionId: string | undefined, requestId: string): Promise<string>
  sdlSchema?(): Promise<string> // TODO: remove it from the library engine entirely
  startTransaction(options: string, traceHeaders: string, requestId: string): Promise<string>
  commitTransaction(id: string, traceHeaders: string, requestId: string): Promise<string>
  rollbackTransaction(id: string, traceHeaders: string, requestId: string): Promise<string>
  metrics?(options: string): Promise<string>
  applyPendingMigrations?(): Promise<void>
  trace(requestId: string): Promise<string | null>
}

export interface QueryEngineConstructor {
  new (
    config: QueryEngineConfig,
    logger: (log: string) => void,
    adapter?: ErrorCapturingDriverAdapter,
  ): QueryEngineInstance
}

export interface LibraryLoader {
  loadLibrary(config: EngineConfig): Promise<Library>
}

// Main
export type Library = {
  QueryEngine: QueryEngineConstructor
  version: () => {
    // The commit hash of the engine
    commit: string
    // Currently 0.1.0 (Set in Cargo.toml)
    version: string
  }
  /**
   * This returns a string representation of `DMMF.Document`
   */
  dmmf: (datamodel: string) => Promise<string>
  /**
   * Artificial panic function that can be used to test the query engine
   */
  debugPanic: (message?: string) => Promise<never>
}
