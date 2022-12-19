import Debug from '@prisma/debug'
import { DMMF } from '@prisma/generator-helper'

import type {
  BatchQueryEngineResult,
  EngineConfig,
  EngineEventType,
  GetConfigResult,
  InlineDatasource,
  InteractiveTransactionOptions,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
import { Engine } from '../common/Engine'
import { PrismaClientUnknownRequestError } from '../common/errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../common/errors/utils/prismaGraphQLToJSError'
import { EventEmitter } from '../common/types/Events'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import {
  QueryEngineBatchRequest,
  QueryEngineRequestHeaders,
  QueryEngineResult,
  QueryEngineResultBatchQueryResult,
} from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { DataProxyError } from './errors/DataProxyError'
import { ForcedRetryError } from './errors/ForcedRetryError'
import { InvalidDatasourceError } from './errors/InvalidDatasourceError'
import { NotImplementedYetError } from './errors/NotImplementedYetError'
import { SchemaMissingError } from './errors/SchemaMissingError'
import { responseToError } from './errors/utils/responseToError'
import { backOff } from './utils/backOff'
import { getClientVersion } from './utils/getClientVersion'
import { request } from './utils/request'

const MAX_RETRIES = 10

// to defer the execution of promises in the constructor
const P = Promise.resolve()

const debug = Debug('prisma:client:dataproxyEngine')

type DataProxyTxInfoPayload = {
  endpoint: string
}

type DataProxyTxInfo = Tx.Info<DataProxyTxInfoPayload>

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
    this.logEmitter = config.logEmitter

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

  request<T>({ query, headers = {}, transaction }: RequestOptions<DataProxyTxInfoPayload>) {
    this.logEmitter.emit('query', { query })

    // TODO: `elapsed`?
    return this.requestInternal<T>({ query, variables: {} }, headers, transaction)
  }

  async requestBatch<T>({
    queries,
    headers = {},
    transaction,
  }: RequestBatchOptions): Promise<BatchQueryEngineResult<T>[]> {
    const isTransaction = Boolean(transaction)
    this.logEmitter.emit('query', {
      query: `Batch${isTransaction ? ' in transaction' : ''} (${queries.length}):\n${queries.join('\n')}`,
    })

    const body: QueryEngineBatchRequest = {
      batch: queries.map((query) => ({ query, variables: {} })),
      transaction: isTransaction,
      isolationLevel: transaction?.isolationLevel,
    }

    const { batchResult, elapsed } = await this.requestInternal<T, true>(body, headers)

    return batchResult.map((result) => {
      if ('errors' in result && result.errors.length > 0) {
        return prismaGraphQLToJSError(result.errors[0], this.clientVersion!)
      }
      return {
        data: result as T,
        elapsed,
      }
    })
  }

  private requestInternal<T, Batch extends boolean = false>(
    body: Record<string, any>,
    headers: QueryEngineRequestHeaders,
    itx?: InteractiveTransactionOptions<DataProxyTxInfoPayload>,
  ): Promise<
    Batch extends true ? { batchResult: QueryEngineResultBatchQueryResult<T>[]; elapsed: number } : QueryEngineResult<T>
  > {
    return this.withRetry({
      actionGerund: 'querying',
      callback: async ({ logHttpCall }) => {
        const url = itx ? `${itx.payload.endpoint}/graphql` : await this.url('graphql')

        logHttpCall(url)

        const response = await request(url, {
          method: 'POST',
          headers: { ...runtimeHeadersToHttpHeaders(headers), ...this.headers },
          body: JSON.stringify(body),
          clientVersion: this.clientVersion,
        })

        if (!response.ok) {
          debug('graphql response status', response.status)
        }

        const e = await responseToError(response, this.clientVersion)
        await this.handleError(e)

        const data = await response.json()

        // TODO: headers contain `x-elapsed` and it needs to be returned

        if (data.errors) {
          if (data.errors.length === 1) {
            throw prismaGraphQLToJSError(data.errors[0], this.config.clientVersion!)
          } else {
            throw new PrismaClientUnknownRequestError(data.errors, { clientVersion: this.config.clientVersion! })
          }
        }

        return data
      },
    })
  }

  /**
   * Send START, COMMIT, or ROLLBACK to the Query Engine
   * @param action START, COMMIT, or ROLLBACK
   * @param headers headers for tracing
   * @param options to change the default timeouts
   * @param info transaction information for the QE
   */
  transaction(action: 'start', headers: Tx.TransactionHeaders, options?: Tx.Options): Promise<DataProxyTxInfo>
  transaction(action: 'commit', headers: Tx.TransactionHeaders, info: DataProxyTxInfo): Promise<undefined>
  transaction(action: 'rollback', headers: Tx.TransactionHeaders, info: DataProxyTxInfo): Promise<undefined>
  async transaction(action: any, headers: Tx.TransactionHeaders, arg?: any) {
    const actionToGerund = {
      start: 'starting',
      commit: 'committing',
      rollback: 'rolling back',
    }

    return this.withRetry({
      actionGerund: `${actionToGerund[action]} transaction`,
      callback: async ({ logHttpCall }) => {
        if (action === 'start') {
          const body = JSON.stringify({
            max_wait: arg?.maxWait ?? 2000, // default
            timeout: arg?.timeout ?? 5000, // default
            isolation_level: arg?.isolationLevel,
          })

          const url = await this.url('transaction/start')

          logHttpCall(url)

          const response = await request(url, {
            method: 'POST',
            headers: { ...runtimeHeadersToHttpHeaders(headers), ...this.headers },
            body,
            clientVersion: this.clientVersion,
          })

          const err = await responseToError(response, this.clientVersion)
          await this.handleError(err)

          const json = await response.json()
          const id = json.id as string
          const endpoint = json['data-proxy'].endpoint as string

          return { id, payload: { endpoint } }
        } else {
          const url = `${arg.payload.endpoint}/${action}`

          logHttpCall(url)

          const response = await request(url, {
            method: 'POST',
            headers: { ...runtimeHeadersToHttpHeaders(headers), ...this.headers },
            clientVersion: this.clientVersion,
          })

          const err = await responseToError(response, this.clientVersion)
          await this.handleError(err)

          return undefined
        }
      },
    })
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

  private async withRetry<T>(args: {
    callback: (api: { logHttpCall: (url: string) => void }) => Promise<T>
    actionGerund: string
  }): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const logHttpCall = (url: string) => {
        this.logEmitter.emit('info', {
          message: `Calling ${url} (n=${attempt})`,
        })
      }

      try {
        return await args.callback({ logHttpCall })
      } catch (e) {
        if (!(e instanceof DataProxyError)) throw e
        if (!e.isRetryable) throw e
        if (attempt >= MAX_RETRIES) {
          if (e instanceof ForcedRetryError) {
            throw e.cause
          } else {
            throw e
          }
        }

        this.logEmitter.emit('warn', {
          message: `Attempt ${attempt + 1}/${MAX_RETRIES} failed for ${args.actionGerund}: ${e.message ?? '(unknown)'}`,
        })
        const delay = await backOff(attempt)
        this.logEmitter.emit('warn', { message: `Retrying after ${delay}ms` })
      }
    }
  }

  private async handleError(error: DataProxyError | undefined): Promise<void> {
    if (error instanceof SchemaMissingError) {
      await this.uploadSchema()
      throw new ForcedRetryError({
        clientVersion: this.clientVersion,
        cause: error,
      })
    } else if (error) {
      throw error
    }
  }
}

/**
 * Convert runtime headers to HTTP headers expected by the Data Proxy by removing the transactionId runtime header.
 */
function runtimeHeadersToHttpHeaders(headers: QueryEngineRequestHeaders): Record<string, string | undefined> {
  if (headers.transactionId) {
    const httpHeaders = { ...headers }
    delete httpHeaders.transactionId
    return httpHeaders
  }
  return headers
}
