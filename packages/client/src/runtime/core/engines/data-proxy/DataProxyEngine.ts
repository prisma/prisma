import Debug from '@prisma/debug'
import { DMMF } from '@prisma/generator-helper'
import { EngineSpan, TracingHelper } from '@prisma/internals'

import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type {
  BatchQueryEngineResult,
  EngineBatchQueries,
  EngineConfig,
  EngineEventType,
  EngineQuery,
  InlineDatasource,
  InteractiveTransactionOptions,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
import { Engine } from '../common/Engine'
import { EventEmitter } from '../common/types/Events'
import { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import { QueryEngineResult, QueryEngineResultBatchQueryResult } from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { LogLevel } from '../common/utils/log'
import { DataProxyError } from './errors/DataProxyError'
import { ForcedRetryError } from './errors/ForcedRetryError'
import { InvalidDatasourceError } from './errors/InvalidDatasourceError'
import { NotImplementedYetError } from './errors/NotImplementedYetError'
import { SchemaMissingError } from './errors/SchemaMissingError'
import { responseToError } from './errors/utils/responseToError'
import { backOff } from './utils/backOff'
import { getClientVersion } from './utils/getClientVersion'
import { Fetch, request } from './utils/request'

const MAX_RETRIES = 3

// to defer the execution of promises in the constructor
const P = Promise.resolve()

const debug = Debug('prisma:client:dataproxyEngine')

type DataProxyTxInfoPayload = {
  endpoint: string
}

type DataProxyTxInfo = Tx.InteractiveTransactionInfo<DataProxyTxInfoPayload>

type RequestInternalOptions = {
  body: Record<string, unknown>
  customDataProxyFetch?: (fetch: Fetch) => Fetch
  traceparent?: string
  interactiveTransaction?: InteractiveTransactionOptions<DataProxyTxInfoPayload>
}

type DataProxyLog = {
  span_id: string
  name: string
  level: LogLevel
  timestamp: [number, number]
  attributes: Record<string, unknown> & { duration_ms: number; params: string; target: string }
}

type DataProxyExtensions = {
  logs?: DataProxyLog[]
  traces?: EngineSpan[]
}

type DataProxyHeaders = {
  Authorization: string
  'X-capture-telemetry'?: string
  traceparent?: string
}

type HeaderBuilderOptions = {
  traceparent?: string
  interactiveTransaction?: InteractiveTransactionOptions<DataProxyTxInfoPayload>
}

class DataProxyHeaderBuilder {
  readonly apiKey: string
  readonly tracingHelper: TracingHelper
  readonly logLevel: EngineConfig['logLevel']
  readonly logQueries: boolean | undefined

  constructor({
    apiKey,
    tracingHelper,
    logLevel,
    logQueries,
  }: {
    apiKey: string
    tracingHelper: TracingHelper
    logLevel: EngineConfig['logLevel']
    logQueries: boolean | undefined
  }) {
    this.apiKey = apiKey
    this.tracingHelper = tracingHelper
    this.logLevel = logLevel
    this.logQueries = logQueries
  }

  build({ traceparent, interactiveTransaction }: HeaderBuilderOptions = {}): DataProxyHeaders {
    const headers: DataProxyHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
    }

    if (this.tracingHelper.isEnabled()) {
      headers.traceparent = traceparent ?? this.tracingHelper.getTraceParent()
    }

    if (interactiveTransaction) {
      headers['X-transaction-id'] = interactiveTransaction.id
    }

    const captureTelemetry: string[] = this.buildCaptureSettings()

    if (captureTelemetry.length > 0) {
      headers['X-capture-telemetry'] = captureTelemetry.join(', ')
    }

    return headers
  }

  private buildCaptureSettings() {
    const captureTelemetry: string[] = []

    if (this.tracingHelper.isEnabled()) {
      captureTelemetry.push('tracing')
    }

    if (this.logLevel) {
      captureTelemetry.push(this.logLevel)
    }

    if (this.logQueries) {
      captureTelemetry.push('query')
    }
    return captureTelemetry
  }
}

export class DataProxyEngine extends Engine<DataProxyTxInfoPayload> {
  private inlineSchema: string
  readonly inlineSchemaHash: string
  private inlineDatasources: Record<string, InlineDatasource>
  private config: EngineConfig
  private logEmitter: EventEmitter
  private env: { [k in string]?: string }

  private clientVersion: string
  private tracingHelper: TracingHelper
  readonly remoteClientVersion: Promise<string>
  readonly host: string
  readonly headerBuilder: DataProxyHeaderBuilder

  constructor(config: EngineConfig) {
    super()

    this.config = config
    this.env = { ...this.config.env, ...process.env }
    this.inlineSchema = config.inlineSchema ?? ''
    this.inlineDatasources = config.inlineDatasources ?? {}
    this.inlineSchemaHash = config.inlineSchemaHash ?? ''
    this.clientVersion = config.clientVersion ?? 'unknown'
    this.logEmitter = config.logEmitter
    this.tracingHelper = this.config.tracingHelper

    const [host, apiKey] = this.extractHostAndApiKey()
    this.host = host

    this.headerBuilder = new DataProxyHeaderBuilder({
      apiKey,
      tracingHelper: this.tracingHelper,
      logLevel: config.logLevel,
      logQueries: config.logQueries,
    })

    this.remoteClientVersion = P.then(() => getClientVersion(this.config))

    debug('host', this.host)
  }

  apiKey(): string {
    return this.headerBuilder.apiKey
  }

  version() {
    // QE is remote, we don't need to know the exact commit SHA
    return 'unknown'
  }

  async start() {}
  async stop() {}

  private propagateResponseExtensions(extensions: DataProxyExtensions): void {
    if (extensions?.logs?.length) {
      extensions.logs.forEach((log) => {
        switch (log.level) {
          case 'debug':
          case 'error':
          case 'trace':
          case 'warn':
          case 'info':
            // TODO these are propagated into the response.errors key
            break
          case 'query': {
            let dbQuery = typeof log.attributes.query === 'string' ? log.attributes.query : ''

            if (!this.tracingHelper.isEnabled()) {
              // The engine uses tracing to consolidate logs
              //  - and so we should strip the generated traceparent
              //  - if tracing is disabled.
              // Example query: 'SELECT /* traceparent=00-123-0-01 */'
              const [query] = dbQuery.split('/* traceparent')
              dbQuery = query
            }

            this.logEmitter.emit('query', {
              query: dbQuery,
              timestamp: log.timestamp,
              duration: log.attributes.duration_ms,
              params: log.attributes.params,
              target: log.attributes.target,
            })
          }
        }
      })
    }

    if (extensions?.traces?.length) {
      void this.tracingHelper.createEngineSpan({ span: true, spans: extensions.traces })
    }
  }

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

  getDmmf(): Promise<DMMF.Document> {
    // This code path should not be reachable, as it is handled upstream in `getPrismaClient`.
    throw new NotImplementedYetError('getDmmf is not yet supported', {
      clientVersion: this.clientVersion,
    })
  }

  private async uploadSchema() {
    const spanOptions = {
      name: 'schemaUpload',
      internal: true,
    }

    return this.tracingHelper.runInChildSpan(spanOptions, async () => {
      const response = await request(await this.url('schema'), {
        method: 'PUT',
        headers: this.headerBuilder.build(),
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
    })
  }

  request<T>(
    query: EngineQuery,
    { traceparent, interactiveTransaction, customDataProxyFetch }: RequestOptions<DataProxyTxInfoPayload>,
  ) {
    // TODO: `elapsed`?
    return this.requestInternal<T>({
      body: query,
      traceparent,
      interactiveTransaction,
      customDataProxyFetch,
    })
  }

  async requestBatch<T>(
    queries: EngineBatchQueries,
    { traceparent, transaction, customDataProxyFetch }: RequestBatchOptions<DataProxyTxInfoPayload>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    const interactiveTransaction = transaction?.kind === 'itx' ? transaction.options : undefined

    const body = getBatchRequestPayload(queries, transaction)

    const { batchResult, elapsed } = await this.requestInternal<T, true>({
      body,
      customDataProxyFetch,
      interactiveTransaction,
      traceparent,
    })

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

  private requestInternal<T, Batch extends boolean = false>({
    body,
    traceparent,
    customDataProxyFetch,
    interactiveTransaction,
  }: RequestInternalOptions): Promise<
    Batch extends true ? { batchResult: QueryEngineResultBatchQueryResult<T>[]; elapsed: number } : QueryEngineResult<T>
  > {
    return this.withRetry({
      actionGerund: 'querying',
      callback: async ({ logHttpCall }) => {
        const url = interactiveTransaction
          ? `${interactiveTransaction.payload.endpoint}/graphql`
          : await this.url('graphql')

        logHttpCall(url)

        const response = await request(
          url,
          {
            method: 'POST',
            headers: this.headerBuilder.build({ traceparent, interactiveTransaction }),
            body: JSON.stringify(body),
            clientVersion: this.clientVersion,
          },
          customDataProxyFetch,
        )

        if (!response.ok) {
          debug('graphql response status', response.status)
        }

        const e = await responseToError(response, this.clientVersion)
        await this.handleError(e)

        const data = await response.json()
        const extensions = data.extensions as DataProxyExtensions | undefined
        if (extensions) {
          this.propagateResponseExtensions(extensions)
        }

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
            headers: this.headerBuilder.build({ traceparent: headers.traceparent }),
            body,
            clientVersion: this.clientVersion,
          })

          const err = await responseToError(response, this.clientVersion)
          await this.handleError(err)

          const json = await response.json()

          const extensions = json.extensions as DataProxyExtensions | undefined
          if (extensions) {
            this.propagateResponseExtensions(extensions)
          }

          const id = json.id as string
          const endpoint = json['data-proxy'].endpoint as string

          return { id, payload: { endpoint } }
        } else {
          const url = `${arg.payload.endpoint}/${action}`

          logHttpCall(url)

          const response = await request(url, {
            method: 'POST',
            headers: this.headerBuilder.build({ traceparent: headers.traceparent }),
            clientVersion: this.clientVersion,
          })

          const json = await response.json()
          const extensions = json.extensions as DataProxyExtensions | undefined
          if (extensions) {
            this.propagateResponseExtensions(extensions)
          }

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
  metrics(): Promise<Metrics> | Promise<string> {
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
