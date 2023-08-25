import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { TracingHelper } from '@prisma/internals'

import { Datasources, GetPrismaClientConfig } from '../../../getPrismaClient'
import { Fetch } from '../data-proxy/utils/request'
import { LogEmitter } from './types/Events'
import { JsonQuery } from './types/JsonProtocol'
import type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from './types/Metrics'
import type { QueryEngineResult } from './types/QueryEngine'
import type * as Transaction from './types/Transaction'

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

// TODO Move shared logic in here
export abstract class Engine<InteractiveTransactionPayload = unknown> {
  abstract onBeforeExit(callback: () => Promise<void>): void
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract version(forceRun?: boolean): Promise<string> | string
  abstract request<T>(
    query: JsonQuery,
    options: RequestOptions<InteractiveTransactionPayload>,
  ): Promise<QueryEngineResult<T>>
  abstract requestBatch<T>(
    queries: JsonQuery[],
    options: RequestBatchOptions<InteractiveTransactionPayload>,
  ): Promise<BatchQueryEngineResult<T>[]>
  abstract transaction(
    action: 'start',
    headers: Transaction.TransactionHeaders,
    options?: Transaction.Options,
  ): Promise<Transaction.InteractiveTransactionInfo<unknown>>
  abstract transaction(
    action: 'commit',
    headers: Transaction.TransactionHeaders,
    info: Transaction.InteractiveTransactionInfo<unknown>,
  ): Promise<void>
  abstract transaction(
    action: 'rollback',
    headers: Transaction.TransactionHeaders,
    info: Transaction.InteractiveTransactionInfo<unknown>,
  ): Promise<void>

  abstract metrics(options: MetricsOptionsJson): Promise<Metrics>
  abstract metrics(options: MetricsOptionsPrometheus): Promise<string>
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

  /**
   * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`.
   * If set, this is only used in the library engine, and all queries would be performed through it,
   * rather than Prisma's Rust drivers.
   */
  adapter?: ErrorCapturingDriverAdapter

  /**
   * The contents of the schema encoded into a string
   * @remarks only used for the purpose of data proxy
   */
  inlineSchema: string

  /**
   * The contents of the datasource url saved in a string
   * @remarks only used for the purpose of data proxy
   */
  inlineDatasources: GetPrismaClientConfig['inlineDatasources']

  /**
   * The string hash that was produced for a given schema
   * @remarks only used for the purpose of data proxy
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
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
