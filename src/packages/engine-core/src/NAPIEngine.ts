import { DMMF } from '@prisma/generator-helper'
import {
  DatasourceOverwrite,
  Engine,
  EngineConfig,
  EngineEventType,
  GetConfigResult,
} from './Engine'
import fs from 'fs'
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  RequestError,
} from './errors'
// TODO: use more elaborate logic
const { QueryEngine: _QueryEngine } = require('../libquery_engine_napi.so.node')

const QueryEngine: QueryEngineConstructor = _QueryEngine

type QueryEngineConfig = {
  datamodel: string
  datasourceOverrides?: Record<string, string>
}

export interface QueryEngineConstructor {
  new (config: QueryEngineConfig): QueryEngine
}

type ConnectArgs = {
  enableRawQueries: boolean
}

export type QueryEngine = {
  connect(connectArgs: ConnectArgs): Promise<void>
  disconnect(): void
  getConfig(): Promise<GetConfigResult>
  dmmf(): Promise<DMMF.Document>
  query(request: any): Promise<string>
  sdlSchema(): Promise<string>
  serverInfo(): Promise<string> // ServerInfo
}

type ServerInfo = {
  commit: string
  version: string
  primaryConnector: string
}

type SyncRustError = {
  is_panic: boolean
  message: string
  meta: {
    full_error: string
  }
  error_code: string
}

type RustRequestError = {
  is_panic: boolean
  message: string
  backtrace: string
}

export class NAPIEngine implements Engine {
  private engine: QueryEngine
  private startPromise?: Promise<void>
  constructor(private config: EngineConfig) {
    const datamodel = fs.readFileSync(config.datamodelPath, 'utf-8')
    this.engine = this.makeQueryEngine({
      datamodel,
      datasourceOverrides: config.datasources
        ? this.convertDatasources(config.datasources)
        : {},
    })
  }

  private convertDatasources(
    datasources: DatasourceOverwrite[],
  ): Record<string, string> {
    const obj = Object.create(null)
    for (const { name, url } of datasources) {
      obj[name] = url
    }
    return obj
  }
  makeQueryEngine({
    datamodel,
    datasourceOverrides,
  }: QueryEngineConfig): QueryEngine {
    try {
      const engine = new QueryEngine({
        datamodel,
        datasourceOverrides,
      })
      return engine
    } catch (e) {
      const error = this.parseInitError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientInitializationError(
          error.message,
          this.config.clientVersion!,
          error.error_code,
        )
      }
    }
  }
  private parseInitError(str: string): SyncRustError | string {
    try {
      const error = JSON.parse(str)
      if (typeof error.is_panic !== 'undefined') {
        return error
      }
    } catch (e) {
      //
    }
    return str
  }
  private parseRequestError(str: string): RustRequestError | string {
    try {
      const error = JSON.parse(str)
      if (typeof error.is_panic !== 'undefined') {
        return error
      }
    } catch (e) {
      //
    }
    return str
  }
  on(event: EngineEventType, listener: (args?: any) => any): void {}
  async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise
    }
    this.startPromise = this.engine.connect({ enableRawQueries: true })
    return this.startPromise
  }
  async stop(): Promise<void> {
    return this.engine.disconnect()
  }
  kill(signal: string): void {
    return this.engine.disconnect()
  }
  async getConfig(): Promise<GetConfigResult> {
    return this.engine.getConfig()
  }
  async version(forceRun?: boolean): Promise<string> {
    const serverInfo: ServerInfo = JSON.parse(await this.engine.serverInfo())
    return serverInfo.version
  }
  private graphQLToJSError(
    error: RequestError,
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    if (error.user_facing_error.error_code) {
      return new PrismaClientKnownRequestError(
        error.user_facing_error.message,
        error.user_facing_error.error_code,
        this.config.clientVersion!,
        error.user_facing_error.meta,
      )
    }

    return new PrismaClientUnknownRequestError(
      error.user_facing_error.message,
      this.config.clientVersion!,
    )
  }
  async request<T>(
    query: string,
    headers: Record<string, string>,
    numTry: number,
  ): Promise<T> {
    await this.start()
    try {
      const data = JSON.parse(await this.engine.query({ query, variables: {} }))
      if (data.errors) {
        if (data.errors.length === 1) {
          throw this.graphQLToJSError(data.errors[0])
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(
          JSON.stringify(data.errors),
          this.config.clientVersion!,
        )
      }
      return data
    } catch (e) {
      const error = this.parseRequestError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientUnknownRequestError(
          `${error.message}\n${error.backtrace}`,
          this.config.clientVersion!,
        )
      }
    }
  }
  async requestBatch<T>(
    queries: string[],
    transaction?: boolean,
    numTry?: number,
  ): Promise<any> {
    const variables = {}
    const body = {
      batch: queries.map((query) => ({ query, variables })),
      transaction,
    }
    const result = await this.engine.query(body)
    const data = JSON.parse(result)
    if (data.errors) {
      if (data.errors.length === 1) {
        throw this.graphQLToJSError(data.errors[0])
      }
      // this case should not happen, as the query engine only returns one error
      throw new PrismaClientUnknownRequestError(
        JSON.stringify(data.errors),
        this.config.clientVersion!,
      )
    }
    return data
  }
}
