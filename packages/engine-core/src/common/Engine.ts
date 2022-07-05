import type { DataSource, DMMF, EnvValue, GeneratorConfig } from '@prisma/generator-helper'

import type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from './types/Metrics'
import type { QueryEngineRequestHeaders, QueryEngineResult } from './types/QueryEngine'
import type * as Transaction from './types/Transaction'

export interface FilterConstructor {
  new (config: EngineConfig): Engine
}

export type InlineDatasource = {
  url: EnvValue
}

// TODO Move shared logic in here
export abstract class Engine {
  abstract on(event: EngineEventType, listener: (args?: any) => any): void
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract getConfig(): Promise<GetConfigResult>
  abstract getDmmf(): Promise<DMMF.Document>
  abstract version(forceRun?: boolean): Promise<string> | string
  abstract request<T>(
    query: string,
    headers?: QueryEngineRequestHeaders,
    numTry?: number,
  ): Promise<QueryEngineResult<T>>
  abstract requestBatch<T>(
    queries: string[],
    headers?: QueryEngineRequestHeaders,
    transaction?: boolean,
    numTry?: number,
  ): Promise<QueryEngineResult<T>[]>
  abstract transaction(
    action: 'start',
    headers: Transaction.TransactionHeaders,
    options?: Transaction.Options,
  ): Promise<Transaction.Info>
  abstract transaction(action: 'commit', headers: Transaction.TransactionHeaders, info: Transaction.Info): Promise<void>
  abstract transaction(
    action: 'rollback',
    headers: Transaction.TransactionHeaders,
    info: Transaction.Info,
  ): Promise<void>

  abstract metrics(options: MetricsOptionsJson): Promise<Metrics>
  abstract metrics(options: MetricsOptionsPrometheus): Promise<string>

  abstract _hasPreviewFlag(feature: string): Boolean
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
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
