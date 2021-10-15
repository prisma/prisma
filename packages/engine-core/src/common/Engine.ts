import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import type * as Transaction from './types/Transaction'
import type {
  QueryEngineRequestHeaders,
  QueryEngineResult,
} from './types/QueryEngine'

export interface FilterConstructor {
  new (config: EngineConfig): Engine
}

// TODO Move shared logic in here
export abstract class Engine {
  abstract on(event: EngineEventType, listener: (args?: any) => any): void
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
  abstract getConfig(): Promise<GetConfigResult>
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
    options?: Transaction.Options,
  ): Promise<Transaction.Info>
  abstract transaction(action: 'commit', info: Transaction.Info): Promise<void>
  abstract transaction(
    action: 'rollback',
    info: Transaction.Info,
  ): Promise<void>
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
  env?: Record<string, string>
  flags?: string[]
  useUds?: boolean

  /**
   * A Base64 string representing the schema when using the DataProxy
   */
  inlineSchema?: string

  clientVersion?: string
  previewFeatures?: string[]
  engineEndpoint?: string
  activeProvider?: string
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
