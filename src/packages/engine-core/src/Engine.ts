import { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import type * as Tx from './definitions/Transaction'

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
    headers: Record<string, string>,
    numTry: number,
  ): Promise<{ data: T; elapsed: number }>
  abstract requestBatch<T>(
    queries: string[],
    transaction?: boolean,
    numTry?: number,
  ): Promise<{ data: T; elapsed: number }>
  abstract transaction(action: 'start', options?: Tx.Options): Promise<Tx.Info>
  abstract transaction(action: 'commit', info: Tx.Info): Promise<void>
  abstract transaction(action: 'rollback', info: Tx.Info): Promise<void>
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
  enableEngineDebugMode?: boolean // dangerous! https://github.com/prisma/prisma-engines/issues/764
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

  clientVersion?: string
  previewFeatures?: string[]
  engineEndpoint?: string
  activeProvider?: string
}

export type GetConfigResult = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}
