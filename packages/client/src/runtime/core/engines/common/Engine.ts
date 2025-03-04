import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import type { TracingHelper } from '@prisma/internals'

import type { Datasources, GetPrismaClientConfig } from '../../../getPrismaClient'
import type { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import type { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import type { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import type { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { resolveDatasourceUrl } from '../../init/resolveDatasourceUrl'
import type { QueryCompilerConstructor } from '../client/types/QueryCompiler'
import type { QueryEngineConstructor } from '../library/types/Library'
import type { LogEmitter } from './types/Events'
import type { JsonQuery } from './types/JsonProtocol'
import type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from './types/Metrics'
import type { QueryEngineResultData } from './types/QueryEngine'
import type * as Transaction from './types/Transaction'
import type { getBatchRequestPayload } from './utils/getBatchRequestPayload'

export type BatchTransactionOptions = {
  isolationLevel?: Transaction.IsolationLevel
}

export type TransactionOptions<InteractiveTransactionPayload> =
  | {
      kind: 'itx'
      options: InteractiveTransactionOptions<InteractiveTransactionPayload>
    }
  | {
      kind: 'batch'
      options: BatchTransactionOptions
    }

export type InteractiveTransactionOptions<Payload> = Transaction.InteractiveTransactionInfo<Payload>

export type GraphQLQuery = {
  query: string
  variables: object
}

export type EngineProtocol = 'graphql' | 'json'

/**
 * Custom fetch function for `DataProxyEngine`.
 *
 * We can't use the actual type of `globalThis.fetch` because this will result
 * in API Extractor referencing Node.js type definitions in the `.d.ts` bundle
 * for the client runtime. We can only use such types in internal types that
 * don't end up exported anywhere.

 * It's also not possible to write a definition of `fetch` that would accept the
 * actual `fetch` function from different environments such as Node.js and
 * Cloudflare Workers (with their extensions to `RequestInit` and `Response`).
 * `fetch` is used in both covariant and contravariant positions in
 * `CustomDataProxyFetch`, making it invariant, so we need the exact same type.
 * Even if we removed the argument and left `fetch` in covariant position only,
 * then for an extension-supplied function to be assignable to `customDataProxyFetch`,
 * the platform-specific (or custom) `fetch` function needs to be assignable
 * to our `fetch` definition. This, in turn, requires the third-party `Response`
 * to be a subtype of our `Response` (which is not a problem, we could declare
 * a minimal `Response` type that only includes what we use) *and* requires the
 * third-party `RequestInit` to be a supertype of our `RequestInit` (i.e. we
 * have to declare all properties any `RequestInit` implementation in existence
 * could possibly have), which is not possible.
 *
 * Since `@prisma/extension-accelerate` redefines the type of
 * `__internalParams.customDataProxyFetch` to its own type anyway (probably for
 * exactly this reason), our definition is never actually used and is completely
 * ignored, so it doesn't matter, and we can just use `unknown` as the type of
 * `fetch` here.
 */
export type CustomDataProxyFetch = (fetch: unknown) => unknown

export type RequestOptions<InteractiveTransactionPayload> = {
  traceparent?: string
  numTry?: number
  interactiveTransaction?: InteractiveTransactionOptions<InteractiveTransactionPayload>
  isWrite: boolean
  // only used by the data proxy engine
  customDataProxyFetch?: CustomDataProxyFetch
}

export type RequestBatchOptions<InteractiveTransactionPayload> = {
  transaction?: TransactionOptions<InteractiveTransactionPayload>
  traceparent?: string
  numTry?: number
  containsWrite: boolean
  // only used by the data proxy engine
  customDataProxyFetch?: CustomDataProxyFetch
}

export type BatchQueryEngineResult<T> = QueryEngineResultData<T> | Error

export interface Engine<InteractiveTransactionPayload = unknown> {
  /** The name of the engine. This is meant to be consumed externally */
  readonly name: string
  onBeforeExit(callback: () => Promise<void>): void
  start(): Promise<void>
  stop(): Promise<void>
  version(forceRun?: boolean): Promise<string> | string
  request<T>(
    query: JsonQuery,
    options: RequestOptions<InteractiveTransactionPayload>,
  ): Promise<QueryEngineResultData<T>>
  requestBatch<T>(
    queries: JsonQuery[],
    options: RequestBatchOptions<InteractiveTransactionPayload>,
  ): Promise<BatchQueryEngineResult<T>[]>
  transaction(
    action: 'start',
    headers: Transaction.TransactionHeaders,
    options: Transaction.Options,
  ): Promise<Transaction.InteractiveTransactionInfo<unknown>>
  transaction(
    action: 'commit',
    headers: Transaction.TransactionHeaders,
    info: Transaction.InteractiveTransactionInfo<unknown>,
  ): Promise<void>
  transaction(
    action: 'rollback',
    headers: Transaction.TransactionHeaders,
    info: Transaction.InteractiveTransactionInfo<unknown>,
  ): Promise<void>
  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  // Methods dedicated for the C/RN engine, other versions should throw error
  applyPendingMigrations(): Promise<void>
}

export interface EngineConfig {
  cwd: string
  dirname: string
  datamodelPath: string
  enableDebugLogs?: boolean
  allowTriggerPanic?: boolean // dangerous! https://github.com/prisma/prisma-engines/issues/764
  prismaPath?: string
  generator?: GeneratorConfig
  /**
   * @remarks this field is used internally by Policy, do not rename or remove
   */
  overrideDatasources: Datasources
  showColors?: boolean
  logQueries?: boolean
  logLevel?: 'info' | 'warn'
  env: Record<string, string>
  flags?: string[]
  clientVersion: string
  engineVersion: string
  previewFeatures?: string[]
  engineEndpoint?: string
  activeProvider?: string
  logEmitter: LogEmitter
  transactionOptions: Transaction.Options

  /**
   * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`.
   * If set, this is only used in the library engine, and all queries would be performed through it,
   * rather than Prisma's Rust drivers.
   * @remarks only used by LibraryEngine.ts
   */
  adapter?: ErrorCapturingDriverAdapter

  /**
   * The contents of the schema encoded into a string
   * @remarks only used by DataProxyEngine.ts
   */
  inlineSchema: string

  /**
   * The contents of the datasource url saved in a string
   * @remarks only used by DataProxyEngine.ts
   * @remarks this field is used internally by Policy, do not rename or remove
   */
  inlineDatasources: GetPrismaClientConfig['inlineDatasources']

  /**
   * The string hash that was produced for a given schema
   * @remarks only used by DataProxyEngine.ts
   */
  inlineSchemaHash: string

  /**
   * The helper for interaction with OTEL tracing
   * @remarks enabling is determined by the client and @prisma/instrumentation package
   */
  tracingHelper: TracingHelper

  /**
   * Information about whether we have not found a schema.prisma file in the
   * default location, and that we fell back to finding the schema.prisma file
   * in the current working directory. This usually means it has been bundled.
   */
  isBundled?: boolean

  /**
   * Web Assembly module loading configuration
   */
  engineWasm?: EngineWasmLoadingConfig
  compilerWasm?: CompilerWasmLoadingConfig

  /**
   * Allows Accelerate to use runtime utilities from the client. These are
   * necessary for the AccelerateEngine to function correctly.
   */
  accelerateUtils?: {
    resolveDatasourceUrl: typeof resolveDatasourceUrl
    getBatchRequestPayload: typeof getBatchRequestPayload
    prismaGraphQLToJSError: typeof prismaGraphQLToJSError
    PrismaClientUnknownRequestError: typeof PrismaClientUnknownRequestError
    PrismaClientInitializationError: typeof PrismaClientInitializationError
    PrismaClientKnownRequestError: typeof PrismaClientKnownRequestError
    debug: (...args: any[]) => void
    engineVersion: string
    clientVersion: string
  }
}

export type EngineWasmLoadingConfig = {
  /**
   * WASM-bindgen runtime for corresponding module
   */
  getRuntime: () => {
    __wbg_set_wasm(exports: unknown)
    QueryEngine: QueryEngineConstructor
  }
  /**
   * Loads the raw wasm module for the wasm query engine. This configuration is
   * generated specifically for each type of client, eg. Node.js client and Edge
   * clients will have different implementations.
   * @remarks this is a callback on purpose, we only load the wasm if needed.
   * @remarks only used by LibraryEngine
   */
  getQueryEngineWasmModule: () => Promise<unknown>
}

export type CompilerWasmLoadingConfig = {
  /**
   * WASM-bindgen runtime for corresponding module
   */
  getRuntime: () => {
    __wbg_set_wasm(exports: unknown)
    QueryCompiler: QueryCompilerConstructor
  }
  /**
   * Loads the raw wasm module for the wasm compiler engine. This configuration is
   * generated specifically for each type of client, eg. Node.js client and Edge
   * clients will have different implementations.
   * @remarks this is a callback on purpose, we only load the wasm if needed.
   * @remarks only used by ClientEngine
   */
  getQueryCompilerWasmModule: () => Promise<unknown>
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
