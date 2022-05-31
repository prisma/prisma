/// <reference lib="webworker" />
// TODO: this is a problem because it propagates everywhere

import EventEmitter from 'events'

import type { EngineConfig, EngineEventType, GetConfigResult } from '../common/Engine'
import { Engine } from '../common/Engine'
import { prismaGraphQLToJSError } from '../common/errors/utils/prismaGraphQLToJSError'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import { DataProxyError } from './errors/DataProxyError'
import { ForcedRetryError } from './errors/ForcedRetryError'
import { InvalidDatasourceError } from './errors/InvalidDatasourceError'
import { NotImplementedYetError } from './errors/NotImplementedYetError'
import { SchemaMissingError } from './errors/SchemaMissingError'
import { responseToError } from './errors/utils/responseToError'
import { backOff } from './utils/backOff'
import { getClientVersion } from './utils/getClientVersion'
import { request } from './utils/request'
// import type { InlineDatasources } from '../../../client/src/generation/utils/buildInlineDatasources'
// TODO this is an issue that we cannot share types from the client to other packages

const MAX_RETRIES = 10

export class DataProxyEngine extends Engine {
  private pushPromise: Promise<void>
  private inlineSchema: string
  private inlineSchemaHash: string
  private inlineDatasources: any
  private config: EngineConfig
  private logEmitter: EventEmitter
  private env: { [k: string]: string }

  private clientVersion: string
  private remoteClientVersion: string
  private headers: { Authorization: string }
  private host: string

  constructor(config: EngineConfig) {
    super()

    this.config = config
    this.env = this.config.env ?? {}
    this.inlineSchema = config.inlineSchema ?? ''
    this.inlineDatasources = config.inlineDatasources ?? {}
    this.inlineSchemaHash = config.inlineSchemaHash ?? ''
    this.clientVersion = config.clientVersion ?? 'unknown'

    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', () => {})

    const [host, apiKey] = this.extractHostAndApiKey()
    this.remoteClientVersion = getClientVersion(this.config)
    this.headers = { Authorization: `Bearer ${apiKey}` }
    this.host = host

    // hack for Cloudflare
    // That's because we instantiate the client outside of the request handler. This essentially prevents immediate execution of the promise.
    // Removing this will produce the following error
    // [Error] Some functionality, such as asynchronous I/O, timeouts, and generating random values, can only be performed while handling a request.
    const promise = Promise.resolve()
    this.pushPromise = promise.then(() => this.pushSchema())
  }

  private async pushSchema() {
    const response = await request(this.url('schema'), {
      method: 'GET',
      headers: this.headers,
    })

    if (response.status === 404) {
      await this.uploadSchema()
    }
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
      throw new NotImplementedYetError('beforeExit event is not yet supported', {
        clientVersion: this.clientVersion,
      })
    } else {
      this.logEmitter.on(event, listener)
    }
  }

  private url(s: string) {
    return `https://${this.host}/${this.remoteClientVersion}/${this.inlineSchemaHash}/${s}`
  }

  // TODO: looks like activeProvider is the only thing
  // used externally; verify that
  async getConfig() {
    return Promise.resolve({
      datasources: [
        {
          activeProvider: this.config.activeProvider,
        },
      ],
    } as GetConfigResult)
  }

  private async uploadSchema() {
    const response = await request(this.url('schema'), {
      method: 'PUT',
      headers: this.headers,
      body: this.inlineSchema,
    })

    const err = await responseToError(response, this.clientVersion)

    if (err) {
      this.logEmitter.emit('warn', { message: `Error while uploading schema: ${err.message}` })
      throw err
    } else {
      this.logEmitter.emit('info', {
        message: `Schema (re)uploaded (hash: ${this.inlineSchemaHash})`,
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
    await this.pushPromise

    try {
      this.logEmitter.emit('info', {
        message: `Calling ${this.url('graphql')} (n=${attempt})`,
      })

      const response = await request(this.url('graphql'), {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body: JSON.stringify(body),
      })

      const err = await responseToError(response, this.clientVersion)

      if (err instanceof SchemaMissingError) {
        await this.uploadSchema()
        throw new ForcedRetryError({
          clientVersion: this.clientVersion,
          cause: err,
        })
      }

      if (err) {
        throw err
      }

      const data = await response.json()

      if (data.errors) {
        if (data.errors.length === 1) {
          throw prismaGraphQLToJSError(data.errors[0], this.config.clientVersion!)
        }
      }

      return data
    } catch (err) {
      this.logEmitter.emit('error', {
        message: `Error while querying: ${err.message ?? '(unknown)'}`,
      })

      if (!(err instanceof DataProxyError)) {
        throw err
      }
      if (!err.isRetryable) {
        throw err
      }
      if (attempt >= MAX_RETRIES) {
        if (err instanceof ForcedRetryError) {
          throw err.cause
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
    throw new NotImplementedYetError('Interactive transactions are not yet supported', {
      clientVersion: this.clientVersion,
    })
  }

  private extractHostAndApiKey() {
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
      throw new InvalidDatasourceError('Could not parse URL of the datasource', {
        clientVersion: this.clientVersion,
      })
    }

    const { protocol, host, searchParams } = url

    if (protocol !== 'prisma:') {
      throw new InvalidDatasourceError(
        'Datasource URL should use prisma:// protocol. If you are not using the Data Proxy, remove the `dataProxy` from the `previewFeatures` in your schema and ensure that `PRISMA_CLIENT_ENGINE_TYPE` environment variable is not set to `dataproxy`.',
        {
          clientVersion: this.clientVersion,
        },
      )
    }

    const apiKey = searchParams.get('api_key')
    if (apiKey === null || apiKey.length < 1) {
      throw new InvalidDatasourceError('No valid API key found in the datasource URL', {
        clientVersion: this.clientVersion,
      })
    }

    return [host, apiKey]
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(options: EngineMetricsOptions): Promise<Metrics> | Promise<string> {
    throw new NotImplementedYetError('Metric are not yet supported', {
      clientVersion: this.clientVersion,
    })
  }
}
