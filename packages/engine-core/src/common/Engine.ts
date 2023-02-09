import type { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'

import { Fetch } from '../data-proxy/utils/request'
import { TracingConfig } from '../tracing/getTracingConfig'
import { EventEmitter } from './types/Events'
import type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from './types/Metrics'
import type { QueryEngineResult } from './types/QueryEngine'
import type * as Transaction from './types/Transaction'

export type NullableEnvValue = {
  fromEnvVar: string | null
  value?: string | null
}

export type InlineDatasource = {
  url: NullableEnvValue
}

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
}

export type EngineQuery = GraphQLQuery // TODO: | JsonRequest

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
  abstract on(event: EngineEventType, listener: (args?: any) => any): void
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract getConfig(): Promise<GetConfigResult>
  abstract getDmmf(): Promise<DMMF.Document>
  abstract version(forceRun?: boolean): Promise<string> | string
  abstract request<T>(
    query: EngineQuery,
    options: RequestOptions<InteractiveTransactionPayload>,
  ): Promise<QueryEngineResult<T>>
  abstract requestBatch<T>(
    query: EngineQuery[],
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

export type EngineEventType = 'query' | 'info' | 'warn' | 'error' | 'beforeExit'

export interface DatasourceOverwrite {
  name: string
  url?: string
  env?: string
}

export interface EngineConfig {
  cwd?: string
  dirname?: string
  datamodelPath: string
  enableDebugLogs?: boolean
  allowTriggerPanic?: boolean // dangerous! https://github.com/prisma/prisma-engines/issues/764
  prismaPath?: string
  fetcher?: (query: string) => Promise<{ data?: any; error?: any }>
  generator?: GeneratorConfig
  datasources?: DatasourceOverwrite[]
  showColors?: boolean
  logQueries?: boolean
  logLevel?: 'info' | 'warn'
  env: Record<string, string>
  flags?: string[]
  clientVersion?: string
  previewFeatures?: string[]
  engineEndpoint?: string
  activeProvider?: string
  logEmitter: EventEmitter

  /**
   * The contents of the schema encoded into a string
   * @remarks only used for the purpose of data proxy
   */
  inlineSchema?: string

  /**
   * The contents of the datasource url saved in a string
   * @remarks only used for the purpose of data proxy
   */
  inlineDatasources?: Record<string, InlineDatasource>

  /**
   * The string hash that was produced for a given schema
   * @remarks only used for the purpose of data proxy
   */
  inlineSchemaHash?: string

  /**
   * The configuration object for enabling tracing
   * @remarks enabling is determined by the client
   */
  tracingConfig: TracingConfig
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
