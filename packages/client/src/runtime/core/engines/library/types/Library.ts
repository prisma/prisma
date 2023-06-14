import type { QueryEngineConfig } from '../../common/types/QueryEngine'

export type QueryEngineInstance = {
  connect(headers: string): Promise<void>
  disconnect(headers: string): Promise<void>
  /**
   * @param requestStr JSON.stringified `QueryEngineRequest | QueryEngineBatchRequest`
   * @param headersStr JSON.stringified `QueryEngineRequestHeaders`
   */
  query(requestStr: string, headersStr: string, transactionId?: string): Promise<string>
  sdlSchema(): Promise<string>
  dmmf(traceparent: string): Promise<string>
  startTransaction(options: string, traceHeaders: string): Promise<string>
  commitTransaction(id: string, traceHeaders: string): Promise<string>
  rollbackTransaction(id: string, traceHeaders: string): Promise<string>
  metrics(options: string): Promise<string>
}

export interface ResultSet {
  columnTypes: Array<ColumnType>
  columnNames: Array<string>
  rows: Array<Array<any>>
}

export interface Query {
  sql: string
  args: Array<any>
}

// Same order as in rust js-drivers' `ColumnType`
export const enum ColumnType {
  Int32 = 0,
  Int64 = 1,
  Float = 2,
  Double = 3,
  Text = 4,
  Enum = 5,
  Bytes = 6,
  Boolean = 7,
  Char = 8,
  Array = 9,
  Numeric = 10,
  Json = 11,
  DateTime = 12,
  Date = 13,
  Time = 14,
}

export type Driver = {
  queryRaw: (query: Query) => Promise<ResultSet>
  executeRaw: (query: Query) => Promise<number>
  version: () => Promise<string | undefined>
  isHealthy: () => boolean
}

export type Closeable = {
  close: () => Promise<void>
}

export interface QueryEngineConstructor {
  new (config: QueryEngineConfig, logger: (log: string) => void, driver?: Driver): QueryEngineInstance
}

export interface LibraryLoader {
  loadLibrary(): Promise<Library>
}

// Main
export type Library = {
  QueryEngine: QueryEngineConstructor
  version: () => {
    // The commit hash of the engine
    commit: string
    // Currently 0.1.0 (Set in Cargo.toml)
    version: string
  }
  /**
   * This returns a string representation of `DMMF.Document`
   */
  dmmf: (datamodel: string) => Promise<string>
  /**
   * Artificial panic function that can be used to test the query engine
   */
  debugPanic: (message?: string) => Promise<never>
}
