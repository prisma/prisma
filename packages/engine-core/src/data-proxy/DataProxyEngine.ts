import Debug from '@prisma/debug'
import { DMMF } from '@prisma/generator-helper'
import EventEmitter from 'events'

import type {
  BatchTransactionOptions,
  EngineConfig,
  EngineEventType,
  GetConfigResult,
  InlineDatasource,
} from '../common/Engine'
import { Engine } from '../common/Engine'
import { prismaGraphQLToJSError } from '../common/errors/utils/prismaGraphQLToJSError'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import { QueryEngineBatchRequest } from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { DataProxyError } from './errors/DataProxyError'
import { ForcedRetryError } from './errors/ForcedRetryError'
import { InvalidDatasourceError } from './errors/InvalidDatasourceError'
import { NotImplementedYetError } from './errors/NotImplementedYetError'
import { SchemaMissingError } from './errors/SchemaMissingError'
import { responseToError } from './errors/utils/responseToError'
import { backOff } from './utils/backOff'
import { getClientVersion } from './utils/getClientVersion'
import { request, RequestResponse } from './utils/request'

const MAX_RETRIES = 10

// to defer the execution of promises in the constructor
const P = Promise.resolve()

const debug = Debug('prisma:client:dataproxyEngine')

export class DataProxyEngine extends Engine {
  private inlineSchema: string
  readonly inlineSchemaHash: string
  private inlineDatasources: Record<string, InlineDatasource>
  private config: EngineConfig
  private logEmitter: EventEmitter
  private env: { [k in string]?: string }

  private clientVersion: string
  readonly remoteClientVersion: Promise<string>
  readonly headers: { Authorization: string }
  readonly host: string

  constructor(config: EngineConfig) {
    super()

    this.config = config
    this.env = { ...this.config.env, ...process.env }
    this.inlineSchema = config.inlineSchema ?? ''
    this.inlineDatasources = config.inlineDatasources ?? {}
    this.inlineSchemaHash = config.inlineSchemaHash ?? ''
    this.clientVersion = config.clientVersion ?? 'unknown'

    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', () => {})

    const [host, apiKey] = this.extractHostAndApiKey()
    this.remoteClientVersion = P.then(() => getClientVersion(this.config))
    this.headers = { Authorization: `Bearer ${apiKey}` }
    this.host = host

    debug('host', this.host)
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

  private async url(s: string) {
    return `https://${this.host}/${await this.remoteClientVersion}/${this.inlineSchemaHash}/${s}`
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

  getDmmf(): Promise<DMMF.Document> {
    // This code path should not be reachable, as it is handled upstream in `getPrismaClient`.
    throw new NotImplementedYetError('getDmmf is not yet supported', {
      clientVersion: this.clientVersion,
    })
  }

  private async uploadSchema() {
    const response = await request(await this.url('schema'), {
      method: 'PUT',
      headers: this.headers,
      body: this.inlineSchema,
      clientVersion: this.clientVersion,
    })

    if (!response.ok) {
      debug('schema response status', response.status)
    }

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

  async requestBatch<T>(
    queries: string[],
    headers: Record<string, string>,
    transaction?: BatchTransactionOptions,
    attempt = 0,
  ) {
    const isTransaction = Boolean(transaction)
    this.logEmitter.emit('query', {
      query: `Batch${isTransaction ? ' in transaction' : ''} (${queries.length}):\n${queries.join('\n')}`,
    })

    const body: QueryEngineBatchRequest = {
      batch: queries.map((query) => ({ query, variables: {} })),
      transaction: isTransaction,
      isolationLevel: transaction?.isolationLevel,
    }

    const { batchResult } = await this.requestInternal<T>(body, headers, attempt)

    return batchResult
  }

  private async requestInternal<T>(body: Record<string, any>, headers: Record<string, string>, attempt: number) {
    try {
      this.logEmitter.emit('info', {
        message: `Calling ${await this.url('graphql')} (n=${attempt})`,
      })

      const transactionId = headers.transactionId

      let url = await this.url('graphql')
      if (transactionId) {
        url = await this.url(`itx/${transactionId}/graphql`)
      }

      const response = await request(url, {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body: JSON.stringify(body),
        clientVersion: this.clientVersion,
      })

      if (!response.ok) {
        debug('graphql response status', response.status)
      }

      const e = await responseToError(response, this.clientVersion)

      if (e instanceof SchemaMissingError) {
        await this.uploadSchema()
        throw new ForcedRetryError({
          clientVersion: this.clientVersion,
          cause: e,
        })
      }

      if (e) throw e

      const data = await response.json()

      if (data.errors) {
        if (data.errors.length === 1) {
          throw prismaGraphQLToJSError(data.errors[0], this.config.clientVersion!)
        }
      }

      return data
    } catch (e) {
      this.logEmitter.emit('error', {
        message: `Error while querying: ${e.message ?? '(unknown)'}`,
      })

      if (!(e instanceof DataProxyError)) throw e
      if (!e.isRetryable) throw e
      if (attempt >= MAX_RETRIES) {
        if (e instanceof ForcedRetryError) {
          throw e.cause
        } else {
          throw e
        }
      }

      this.logEmitter.emit('warn', { message: 'This request can be retried' })
      const delay = await backOff(attempt)
      this.logEmitter.emit('warn', { message: `Retrying after ${delay}ms` })

      return this.requestInternal<T>(body, headers, attempt + 1)
    }
  }

  /**
   * Send START, COMMIT, or ROLLBACK to the Query Engine
   * @param action START, COMMIT, or ROLLBACK
   * @param headers headers for tracing
   * @param options to change the default timeouts
   * @param info transaction information for the QE
   */
  async transaction(action: 'start', headers: Tx.TransactionHeaders, options?: Tx.Options): Promise<Tx.Info>
  async transaction(action: 'commit', headers: Tx.TransactionHeaders, info: Tx.Info): Promise<undefined>
  async transaction(action: 'rollback', headers: Tx.TransactionHeaders, info: Tx.Info): Promise<undefined>
  async transaction(action: any, headers: Tx.TransactionHeaders, arg?: any) {
    await this.start()

    const errorHandler = async (response: RequestResponse) => {
      if (!response.ok) {
        const json = await response.json()

        if (json) {
          throw new Error(`Error in transaction start: ${JSON.stringify(json)}`)
        } else {
          throw new Error(`Error in transaction start: ${response.text()}`)
        }
      }
    }
    if (action === 'start') {
      const body = JSON.stringify({
        max_wait: arg?.maxWait ?? 2000, // default
        timeout: arg?.timeout ?? 5000, // default
        isolation_level: arg?.isolationLevel,
      })

      const url = await this.url('transaction/start')

      const response = await request(url, {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body,
        clientVersion: this.clientVersion,
      })

      await errorHandler(response)

      const json = await response.json()

      const endpoint = json['data-proxy'].endpoint as string

      const id = endpoint.split('/').pop() as string

      const data: Tx.Info = {
        id,
      }

      return data as Tx.Info
    } else {
      const url = await this.url(`transaction/${arg.id}/${action}`)

      const response = await request(url, {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        clientVersion: this.clientVersion,
      })

      await errorHandler(response)

      return undefined
    }
  }

  private extractHostAndApiKey() {
    const datasources = this.mergeOverriddenDatasources()
    const mainDatasourceName = Object.keys(datasources)[0]
    const mainDatasource = datasources[mainDatasourceName]
    const dataProxyURL = this.resolveDatasourceURL(mainDatasourceName, mainDatasource)

    let url: URL
    try {
      url = new URL(dataProxyURL)
    } catch {
      throw new InvalidDatasourceError('Could not parse URL of the datasource', {
        clientVersion: this.clientVersion,
      })
    }

    const { protocol, host, searchParams } = url

    if (protocol !== 'prisma:') {
      throw new InvalidDatasourceError('Datasource URL must use prisma:// protocol when --data-proxy is used', {
        clientVersion: this.clientVersion,
      })
    }

    const apiKey = searchParams.get('api_key')
    if (apiKey === null || apiKey.length < 1) {
      throw new InvalidDatasourceError('No valid API key found in the datasource URL', {
        clientVersion: this.clientVersion,
      })
    }

    return [host, apiKey]
  }

  private mergeOverriddenDatasources(): Record<string, InlineDatasource> {
    if (this.config.datasources === undefined) {
      return this.inlineDatasources
    }

    const finalDatasources = { ...this.inlineDatasources }

    for (const override of this.config.datasources) {
      if (!this.inlineDatasources[override.name]) {
        throw new Error(`Unknown datasource: ${override.name}`)
      }

      finalDatasources[override.name] = {
        url: {
          fromEnvVar: null,
          value: override.url,
        },
      }
    }

    return finalDatasources
  }

  private resolveDatasourceURL(name: string, datasource: InlineDatasource): string {
    if (datasource.url.value) {
      return datasource.url.value
    }

    if (datasource.url.fromEnvVar) {
      const envVar = datasource.url.fromEnvVar
      const loadedEnvURL = this.env[envVar]

      if (loadedEnvURL === undefined) {
        throw new InvalidDatasourceError(
          `Datasource "${name}" references an environment variable "${envVar}" that is not set`,
          {
            clientVersion: this.clientVersion,
          },
        )
      }

      return loadedEnvURL
    }

    throw new InvalidDatasourceError(
      `Datasource "${name}" specification is invalid: both value and fromEnvVar are null`,
      {
        clientVersion: this.clientVersion,
      },
    )
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(options: EngineMetricsOptions): Promise<Metrics> | Promise<string> {
    throw new NotImplementedYetError('Metric are not yet supported for Data Proxy', {
      clientVersion: this.clientVersion,
    })
  }
}
