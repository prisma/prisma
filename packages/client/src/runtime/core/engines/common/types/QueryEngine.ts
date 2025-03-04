import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import type { EngineSpan, EngineTraceEvent } from '@prisma/internals'

import type { EngineProtocol } from '../Engine'
import type { JsonBatchQuery } from './JsonProtocol'
import type { RequestError } from './RequestError'
import type * as Transaction from './Transaction'

// Events
export type QueryEngineEvent = QueryEngineLogEvent | QueryEngineQueryEvent | QueryEnginePanicEvent

export type QueryEngineLogEvent = {
  level: string
  module_path: string
  message: string
  span?: boolean
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
export type QueryEngineLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'off'

export type QueryEngineConfig = {
  // TODO rename datamodel here and other places
  datamodel: string
  configDir: string
  logQueries: boolean
  ignoreEnvVarErrors: boolean
  datasourceOverrides: Record<string, string>
  env: Record<string, string | undefined>
  logLevel: QueryEngineLogLevel
  engineProtocol: EngineProtocol
  enableTracing: boolean
}

export type QueryEngineTelemetry = {
  enabled: boolean
  endpoint: string
}

export type QueryEngineRequest = {
  query: string
  variables: Object
}

export type WithResultExtensions<T> = T & {
  extensions?: QueryEngineResultExtensions
}

type WithErrors<T> =
  | T
  | {
      errors: RequestError[]
    }

type WithErrorsAndResultExtensions<T> = WithResultExtensions<WithErrors<T>>

export type QueryEngineResultData<T> = {
  data: T
}

export type QueryEngineResult<T> = WithErrorsAndResultExtensions<QueryEngineResultData<T>>

export type QueryEngineBatchResult<T> = WithErrorsAndResultExtensions<{
  batchResult: QueryEngineResult<T>[]
}>

export type QueryEngineResultExtensions = {
  logs?: EngineTraceEvent[]
  traces?: EngineSpan[]
}

export type QueryEngineBatchRequest = QueryEngineBatchGraphQLRequest | JsonBatchQuery

export type QueryEngineBatchGraphQLRequest = {
  batch: QueryEngineRequest[]
  transaction?: boolean
  isolationLevel?: Transaction.IsolationLevel
}

export type GetConfigOptions = {
  datamodel: string
  ignoreEnvVarErrors: boolean
  datasourceOverrides: Record<string, string>
  env: Record<string, string | undefined>
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

export type ServerInfo = {
  commit: string
  version: string
  primaryConnector: string
}
