import { ErrorCapturingSqlDriverAdapter } from '@prisma/driver-adapter-utils'

export type EngineWasmLoadingConfig = {
  /**
   * WASM-bindgen runtime for corresponding module
   */
  getRuntime: () => Promise<{
    __wbg_set_wasm(exports: unknown): void
    QueryEngine: QueryEngineConstructor
  }>
  /**
   * Loads the raw wasm module for the wasm query engine. This configuration is
   * generated specifically for each type of client, eg. Node.js client and Edge
   * clients will have different implementations.
   * @remarks this is a callback on purpose, we only load the wasm if needed.
   * @remarks only used by LibraryEngine
   */
  getQueryEngineWasmModule: () => Promise<unknown>
}

export type QueryEngineInstance = {
  connect(headers: string, requestId: string): Promise<void>
  disconnect(headers: string, requestId: string): Promise<void>
  /**
   * Frees any resources allocated by the engine's WASM instance. This method is automatically created by WASM bindgen.
   * Noop for other engines.
   */
  free?(): void
  /**
   * @param requestStr JSON.stringified `QueryEngineRequest | QueryEngineBatchRequest`
   * @param headersStr JSON.stringified `QueryEngineRequestHeaders`
   */
  query(requestStr: string, headersStr: string, transactionId: string | undefined, requestId: string): Promise<string>
  sdlSchema?(): Promise<string> // TODO: remove it from the library engine entirely
  startTransaction(options: string, traceHeaders: string, requestId: string): Promise<string>
  commitTransaction(id: string, traceHeaders: string, requestId: string): Promise<string>
  rollbackTransaction(id: string, traceHeaders: string, requestId: string): Promise<string>
  trace(requestId: string): Promise<string | null>
}

export interface QueryEngineConstructor {
  new (
    config: QueryEngineConfig,
    logger: (log: string) => void,
    adapter?: ErrorCapturingSqlDriverAdapter,
  ): QueryEngineInstance
}

export type QueryEngineConfig = {
  // TODO rename datamodel here and other places
  datamodel: string
  configDir: string
  logQueries: boolean
  ignoreEnvVarErrors: boolean
  datasourceOverrides: Record<string, string>
  env: Record<string, string | undefined>
  logLevel: QueryEngineLogLevel
  engineProtocol: QueryEngineProtocol
  enableTracing: boolean
}

export type QueryEngineLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'off'

export type QueryEngineProtocol = 'graphql' | 'json'
