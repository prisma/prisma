import { ConnectionInfo, Provider } from '@prisma/driver-adapter-utils'

export type BatchResponse = MultiBatchResponse | CompactedBatchResponse

export type MultiBatchResponse = {
  type: 'multi'
  plans: object[]
}

export type CompactedBatchResponse = {
  type: 'compacted'
  plan: {}
  arguments: Record<string, {}>[]
  nestedSelection: string[]
  keys: string[]
  expectNonEmpty: boolean
}

export type QueryCompiler = {
  compile(request: string, dynamicSchema: string): {}
  compileBatch(batchRequest: string, dynamicSchema: string): BatchResponse
  free(): void
}

export type QueryCompilerOptions = {
  datamodel: string
  provider: Provider
  connectionInfo: ConnectionInfo
}

export interface QueryCompilerConstructor {
  new (options: QueryCompilerOptions): QueryCompiler
}

export type CompilerWasmLoadingConfig = {
  /**
   * WASM-bindgen runtime for corresponding module
   */
  getRuntime: () => Promise<{
    __wbg_set_wasm(exports: unknown): void
    QueryCompiler: QueryCompilerConstructor
  }>
  /**
   * Loads the raw wasm module for the wasm compiler engine. This configuration is
   * generated specifically for each type of client, eg. Node.js client and Edge
   * clients will have different implementations.
   * @remarks this is a callback on purpose, we only load the wasm if needed.
   * @remarks only used by ClientEngine
   */
  getQueryCompilerWasmModule: () => Promise<unknown>
}
