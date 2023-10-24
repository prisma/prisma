import { JsonBatchQuery, JsonQuery } from './JsonProtocol'
import * as Transaction from './Transaction'

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


export type GraphQLQuery = {
    query: string
    variables: object
}

export type EngineProtocol = 'graphql' | 'json'
export type EngineQuery = GraphQLQuery | JsonQuery

export type EngineBatchQueries = GraphQLQuery[] | JsonQuery[]

export type QueryEngineConfig = {
    // TODO rename datamodel here and other places
    datamodel: string
    configDir: string
    logQueries: boolean
    ignoreEnvVarErrors: boolean
    datasourceOverrides?: Record<string, string>
    env: Record<string, string | undefined>
    logLevel?: string
    engineProtocol: EngineProtocol
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

export type QueryEngineResult<T> = {
    data: T
    elapsed: number
}

export type QueryEngineBatchRequest = QueryEngineBatchGraphQLRequest | JsonBatchQuery

export type QueryEngineBatchGraphQLRequest = {
    batch: QueryEngineRequest[]
    transaction?: boolean
    isolationLevel?: Transaction.IsolationLevel
}

export type QueryEngineRequest = {
    query: string
    variables: Object
}
