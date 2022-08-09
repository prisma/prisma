import type { ConfigMetaFormat, GetConfigOptions, QueryEngineConfig } from '../../common/types/QueryEngine'

export type QueryEngineInstance = {
  connect(headers: string): Promise<void>
  disconnect(headers: string): Promise<void>
  /**
   * @param requestStr JSON.stringified `QueryEngineRequest | QueryEngineBatchRequest`
   * @param headersStr JSON.stringified `QueryEngineRequestHeaders`
   */
  query(requestStr: string, headersStr: string, transactionId?: string): Promise<string>
  sdlSchema(): Promise<string>
  startTransaction(options: string, traceHeaders: string): Promise<string>
  commitTransaction(id: string, traceHeaders: string): Promise<string>
  rollbackTransaction(id: string, traceHeaders: string): Promise<string>
  metrics(options: string): Promise<string>
}

export interface QueryEngineConstructor {
  new (config: QueryEngineConfig, logger: (log: string) => void): QueryEngineInstance
}

export interface LibraryLoader {
  loadLibrary(): Promise<Library>
}

// Main
export type Library = {
  QueryEngine: QueryEngineConstructor
  version: () => {
    commit: string
    version: string
  }
  getConfig: (options: GetConfigOptions) => Promise<ConfigMetaFormat>
  /**
   * This returns a string representation of `DMMF.Document`
   */
  dmmf: (datamodel: string) => Promise<string>
  /**
   * Artificial panic function that can be used to test the query engine
   */
  debugPanic: (message?: string) => Promise<never>
}
