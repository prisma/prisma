import { DataSource, GeneratorConfig } from '@prisma/generator-helper'

export interface FilterConstructor {
  new (config: EngineConfig): Engine
}

export interface Engine {
  on(event: EngineEventType, listener: (args?: any) => any): void
  start(): Promise<void>
  stop(): Promise<void>
  kill(signal: string): void
  getConfig(): Promise<GetConfigResult>
  version(forceRun?: boolean): Promise<string> | string
  request<T>(
    query: string,
    headers: Record<string, string>,
    numTry: number,
  ): Promise<{ data: T; elapsed: number }>
  requestBatch<T>(
    queries: string[],
    transaction?: boolean,
    numTry?: number,
  ): Promise<{ data: T; elapsed: number }>
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
