import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { TracingHelper } from '@prisma/internals'

import { Datasources, GetPrismaClientConfig } from '../../../getPrismaClient'
import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import type { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { resolveDatasourceUrl } from '../../init/resolveDatasourceUrl'
import { Fetch } from '../data-proxy/utils/request'
import { QueryEngineConstructor } from '../library/types/Library'
import type { LogEmitter } from './types/Events'
import { JsonQuery } from './types/JsonProtocol'
import type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from './types/Metrics'
import type { QueryEngineResult } from './types/QueryEngine'
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

export type RequestOptions<InteractiveTransactionPayload> = {
  traceparent?: string
  numTry?: number
  interactiveTransaction?: InteractiveTransactionOptions<InteractiveTransactionPayload>
  isWrite: boolean
  // only used by the data proxy engine
  customDataProxyFetch?: (fetch: Fetch) => Fetch
}

export type RequestBatchOptions<InteractiveTransactionPayload> = {
  transaction?: TransactionOptions<InteractiveTransactionPayload>
  traceparent?: string
  numTry?: number
  containsWrite: boolean
  // only used by the data proxy engine
  customDataProxyFetch?: (fetch: Fetch) => Fetch
}

export type BatchQueryEngineResult<T> = QueryEngineResult<T> | Error

export interface Engine<InteractiveTransactionPayload = unknown> {
  /** The name of the engine. This is meant to be consumed externally */
  readonly name: string
  onBeforeExit(callback: () => Promise<void>): void
  start(): Promise<void>
  stop(): Promise<void>
  version(forceRun?: boolean): Promise<string> | string
  request<T>(query: JsonQuery, options: RequestOptions<InteractiveTransactionPayload>): Promise<QueryEngineResult<T>>
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
  engineWasm?: WasmLoadingConfig

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

export type WasmLoadingConfig = {
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
   * @remarks only used by LibraryEngine.ts
   */
  getQueryEngineWasmModule: () => Promise<unknown>
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
