import { DataSource, GeneratorConfig } from '@prisma/generator-helper'

// Events
export type QueryEngineEvent =
  | QueryEngineLogEvent
  | QueryEngineQueryEvent
  | QueryEnginePanicEvent

export type QueryEngineLogEvent = {
  level: string
  module_path: string
  message: string
}
export type QueryEngineQueryEvent = {
  level: 'info'
  module_path: string
  query: string
  item_type: 'query'
  params: string
  duration_ms: string
  result: string
}
export type QueryEnginePanicEvent = {
  level: 'error'
  module_path: string
  message: 'PANIC'
  reason: string
  file: string
  line: string
  column: string
}
// Configuration
export type QueryEngineLogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'off'
export type QueryEngineConfig = {
  datamodel: string
  configDir: string
  logQueries: boolean
  ignoreEnvVarErrors: boolean
  datasourceOverrides?: Record<string, string>
  logLevel: QueryEngineLogLevel
  telemetry?: QueryEngineTelemetry
}
export type QueryEngineTelemetry = {
  enabled: Boolean
  endpoint: string
}
export type ConnectArgs = {
  enableRawQueries: boolean
}

export type QueryEngineRequest = {
  query: string
  variables: Object
}
export type QueryEngineRequestHeaders = {
  traceparent?: string
}

export type QueryEngineBatchRequest = {
  batch: QueryEngineRequest[]
  transaction: boolean
}
export type GetConfigOptions = {
  datamodel: string
  ignoreEnvVarErrors: boolean
  datasourceOverrides: Record<string, string>
}
export type GetDMMFOptions = {
  datamodel: string
  enableRawQueries: boolean
}
// Errors
export type SyncRustError = {
  is_panic: boolean
  message: string
  meta: {
    full_error: string
  }
  error_code: string
}

export type RustRequestError = {
  is_panic: boolean
  message: string
  backtrace: string
}
// Responses
export type ConfigMetaFormat = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}
// Main
export type NAPI = {
  QueryEngine: QueryEngineConstructor
  version: () => {
    commit: string
    version: string
  }
  getConfig: (options: GetConfigOptions) => Promise<ConfigMetaFormat>
  /**
   * This returns a string representation of `DMMF.Document`
   */
  dmmf: (datamodel: string) => Promise<string>
}

export interface QueryEngineConstructor {
  new (
    config: QueryEngineConfig,
    logger: (err: string, log: string) => void,
  ): QueryEngine
}

export type QueryEngine = {
  connect(connectArgs: ConnectArgs): Promise<void>
  disconnect(): Promise<void>
  query(
    request: QueryEngineRequest | QueryEngineBatchRequest,
    headers: QueryEngineRequestHeaders,
  ): Promise<string>
  sdlSchema(): Promise<string>
}

export type ServerInfo = {
  commit: string
  version: string
  primaryConnector: string
}
