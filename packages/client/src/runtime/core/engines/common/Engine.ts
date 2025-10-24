import { CompilerWasmLoadingConfig, EngineWasmLoadingConfig, GetPrismaClientConfig } from '@prisma/client-common'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
} from '@prisma/client-runtime-utils'
import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import type { DataSource, GeneratorConfig } from '@prisma/generator'
import { TracingHelper } from '@prisma/internals'

import { Datasources } from '../../../getPrismaClient'
import type { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { resolveDatasourceUrl } from '../../init/resolveDatasourceUrl'
import type { LogEmitter } from './types/Events'
import { JsonQuery } from './types/JsonProtocol'
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

/**
 * A stripped down interface of `fetch` that `@prisma/extension-accelerate`
 * relies on. It must be in sync with the corresponding definition in the
 * Accelerate extension.
 *
 * This is the actual interface exposed by the extension. We can't use the
 * custom fetch function provided by it as normal fetch because the API is
 * different. Notably, `headers` must be an object and not a `Headers`
 * instance, and `url` must be a `string` and not a `URL`.
 *
 * The return type is `Response` but we can't specify this in an exported type
 * because it would end up referencing external types from `@types/node` or DOM
 * which can fail typechecking depending on TypeScript configuration in a user's
 * project.
 */
export type AccelerateExtensionFetch = (
  url: string,
  options: {
    body?: string
    method?: string
    headers: Record<string, string>
  },
) => Promise<unknown>

export type AccelerateExtensionFetchDecorator = (fetch: AccelerateExtensionFetch) => AccelerateExtensionFetch

export type RequestOptions<InteractiveTransactionPayload> = {
  traceparent?: string
  numTry?: number
  interactiveTransaction?: InteractiveTransactionOptions<InteractiveTransactionPayload>
  isWrite: boolean
  // only used by the data proxy engine
  customDataProxyFetch?: AccelerateExtensionFetchDecorator
}

export type RequestBatchOptions<InteractiveTransactionPayload> = {
  transaction?: TransactionOptions<InteractiveTransactionPayload>
  traceparent?: string
  numTry?: number
  containsWrite: boolean
  // only used by the data proxy engine
  customDataProxyFetch?: AccelerateExtensionFetchDecorator
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
}

export interface EngineConfig {
  cwd: string
  dirname: string
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
  adapter?: SqlDriverAdapterFactory

  /**
   * The contents of the schema encoded into a string
   */
  inlineSchema: string

  /**
   * The contents of the datasource url saved in a string
   * @remarks only used by RemoteExecutor.ts
   * @remarks this field is used internally by Policy, do not rename or remove
   */
  inlineDatasources: GetPrismaClientConfig['inlineDatasources']

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

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
