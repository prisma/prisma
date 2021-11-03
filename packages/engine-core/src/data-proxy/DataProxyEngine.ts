/// <reference lib="webworker" />

import { Engine } from '../common/Engine'
import type { EngineConfig, EngineEventType, GetConfigResult } from '../common/Engine'
import { request } from './utils/request'
import EventEmitter from 'events'
import { createSchemaHash } from './utils/createSchemaHash'
import { backOff } from './utils/backOff'
import { getClientVersion } from './utils/getClientVersion'
import {
  DataProxyError,
  ForcedRetryError,
  InvalidDatasourceError,
  NotImplementedYetError,
  responseToError,
  SchemaMissingError,
} from './utils/errors'
// import type { InlineDatasources } from '../../../client/src/generation/utils/buildInlineDatasources'
// TODO this is an issue that we cannot share types from the client to other packages

const randomDebugId = Math.ceil(Math.random() * 1000)

const MAX_RETRIES = 5

export class DataProxyEngine extends Engine {
  private initPromise: Promise<void>
  private inlineSchema: string
  private inlineDatasources: any
  private config: EngineConfig
  private logEmitter: EventEmitter
  private env: { [k: string]: string }

  private clientVersion!: string
  private headers!: { Authorization: string }
  private host!: string
  private schemaHash!: string

  constructor(config: EngineConfig) {
    super()

    this.config = config
    this.env = this.config.env ?? {}
    this.inlineSchema = config.inlineSchema ?? ''
    this.inlineDatasources = config.inlineDatasources ?? {}

    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', () => {})

    this.initPromise = this.init()
  }

  /**
   * !\ Asynchronous constructor that inits the properties marked with `!`.
   * So any function that uses such a property needs to await `initPromise`.
   */
  private async init() {
    // we set the network stuff up for the engine to make http calls to the proxy
    const [host, apiKey] = this.extractHostAndApiKey()
    this.schemaHash = await createSchemaHash(this.inlineSchema)
    this.clientVersion = getClientVersion(this.config)
    this.headers = { Authorization: `Bearer ${apiKey}` }
    this.host = host
  }

  version() {
    // QE is remote, we don't need to know the exact commit SHA
    return 'unknown'
  }

  async start() {}
  async stop() {}

  on(event: EngineEventType, listener: (args?: any) => any): void {
    if (event === 'beforeExit') {
      // TODO: hook into the process
      throw new NotImplementedYetError('beforeExit event is not supported yet')
    } else {
      this.logEmitter.on(event, listener)
    }
  }

  private async url(s: string) {
    await this.initPromise

    return `https://${this.host}/${this.clientVersion}/${this.schemaHash}/${s}?id=${randomDebugId}`
  }

  // TODO: looks like activeProvider is the only thing
  // used externally; verify that
  async getConfig() {
    await this.initPromise

    return {
      datasources: [
        {
          activeProvider: this.config.activeProvider,
        },
      ],
    } as GetConfigResult
  }

  private async uploadSchema() {
    await this.initPromise

    const res = await request(await this.url('schema'), {
      method: 'PUT',
      headers: this.headers,
      body: this.config.inlineSchema,
    })

    const err = await responseToError(res)

    if (err) {
      this.logEmitter.emit('warn', { message: `Error while uploading schema: ${err.message}` })
      throw err
    } else {
      this.logEmitter.emit('info', {
        message: `Schema (re)uploaded (hash: ${this.schemaHash})`,
      })
    }
  }

  request<T>(query: string, headers: Record<string, string>, attempt = 0) {
    this.logEmitter.emit('query', { query })

    return this.requestInternal<T>({ query, variables: {} }, headers, attempt)
  }

  async requestBatch<T>(queries: string[], headers: Record<string, string>, isTransaction = false, attempt = 0) {
    this.logEmitter.emit('query', {
      query: `Batch${isTransaction ? ' in transaction' : ''} (${queries.length}):\n${queries.join('\n')}`,
    })

    const body = {
      batch: queries.map((query) => ({ query, variables: {} })),
      transaction: isTransaction,
    }

    const { batchResult } = await this.requestInternal<T>(body, headers, attempt)

    return batchResult
  }

  private async requestInternal<T>(body: Record<string, any>, headers: Record<string, string>, attempt: number) {
    await this.initPromise

    try {
      this.logEmitter.emit('info', {
        message: `Calling ${await this.url('graphql')} (n=${attempt})`,
      })

      const res = await request(await this.url('graphql'), {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body: JSON.stringify(body),
      })

      const err = await responseToError(res)

      if (err instanceof SchemaMissingError) {
        await this.uploadSchema()
        throw new ForcedRetryError(err)
      }

      if (err) {
        throw err
      }

      return res.json()
    } catch (err) {
      this.logEmitter.emit('error', {
        message: `Error while querying: ${err.message ?? '(unknown)'}`,
      })

      if (!(err instanceof DataProxyError)) {
        throw err
      }
      if (!err.isRetriable) {
        throw err
      }
      if (attempt >= MAX_RETRIES) {
        if (err instanceof ForcedRetryError) {
          throw err.originalError
        } else {
          throw err
        }
      }

      this.logEmitter.emit('warn', { message: 'This request can be retried' })
      const delay = await backOff(attempt)
      this.logEmitter.emit('warn', { message: `Retrying after ${delay}ms` })

      return this.requestInternal<T>(body, headers, attempt + 1)
    }
  }

  // TODO: figure out how to support transactions
  transaction(): Promise<any> {
    throw new NotImplementedYetError('Transactions are currently not supported in Data Proxy')
  }

  extractHostAndApiKey() {
    const mainDatasourceName = Object.keys(this.inlineDatasources)[0]
    const mainDatasource = this.inlineDatasources[mainDatasourceName]
    const mainDatasourceURL = mainDatasource?.url.value
    const mainDatasourceEnv = mainDatasource?.url.fromEnvVar
    const loadedEnvURL = this.env[mainDatasourceEnv]
    const dataProxyURL = mainDatasourceURL ?? loadedEnvURL

    let url: URL
    try {
      url = new URL(dataProxyURL ?? '')
    } catch {
      throw new InvalidDatasourceError('Could not parse URL of the datasource')
    }

    const { protocol, host, searchParams } = url

    if (protocol !== 'prisma:') {
      throw new InvalidDatasourceError('Datasource URL should use prisma:// protocol')
    }

    const apiKey = searchParams.get('api_key')
    if (apiKey === null || apiKey.length < 1) {
      throw new InvalidDatasourceError('No valid API key found in the datasource URL')
    }

    return [host, apiKey]
  }
}
