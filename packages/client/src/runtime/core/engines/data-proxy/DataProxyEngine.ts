import Debug from '@prisma/debug'
import { PRISMA_POSTGRES_PROTOCOL, type TracingHelper } from '@prisma/internals'

import type { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import { resolveDatasourceUrl } from '../../init/resolveDatasourceUrl'
import type {
  BatchQueryEngineResult,
  CustomDataProxyFetch,
  EngineConfig,
  InteractiveTransactionOptions,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
import type { Engine } from '../common/Engine'
import type { LogEmitter } from '../common/types/Events'
import type { JsonQuery } from '../common/types/JsonProtocol'
import type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type {
  QueryEngineBatchResult,
  QueryEngineResult,
  QueryEngineResultData,
  QueryEngineResultExtensions,
} from '../common/types/QueryEngine'
import type { RequestError } from '../common/types/RequestError'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { DataProxyError } from './errors/DataProxyError'
import { ForcedRetryError } from './errors/ForcedRetryError'
import { InvalidDatasourceError } from './errors/InvalidDatasourceError'
import { NotImplementedYetError } from './errors/NotImplementedYetError'
import { SchemaMissingError } from './errors/SchemaMissingError'
import { responseToError } from './errors/utils/responseToError'
import { backOff } from './utils/backOff'
import { toBase64 } from './utils/base64'
import { checkForbiddenMetrics } from './utils/checkForbiddenMetrics'
import { dateFromEngineTimestamp } from './utils/EngineTimestamp'
import { getClientVersion } from './utils/getClientVersion'
import { request } from './utils/request'

const MAX_RETRIES = 3

const debug = Debug('prisma:client:dataproxyEngine')

type DataProxyTxInfoPayload = {
  endpoint: string
}

type DataProxyTxInfo = Tx.InteractiveTransactionInfo<DataProxyTxInfoPayload>

type RequestInternalOptions = {
  body: Record<string, unknown>
  customDataProxyFetch?: CustomDataProxyFetch
  traceparent?: string
  interactiveTransaction?: InteractiveTransactionOptions<DataProxyTxInfoPayload>
}

type DataProxyHeaders = {
  Authorization: string
  'X-capture-telemetry'?: string
  traceparent?: string
  'Prisma-Engine-Hash': string
}

type HeaderBuilderOptions = {
  traceparent?: string
  interactiveTransaction?: InteractiveTransactionOptions<DataProxyTxInfoPayload>
}

type StartTransactionResult = {
  id: string
  'data-proxy': {
    endpoint: string
  }
  extensions?: QueryEngineResultExtensions
}

type CloseTransactionResult = {
  extensions?: QueryEngineResultExtensions
}

class DataProxyHeaderBuilder {
  readonly apiKey: string
  readonly tracingHelper: TracingHelper
  readonly logLevel: EngineConfig['logLevel']
  readonly logQueries: boolean | undefined
  readonly engineHash: string

  constructor({
    apiKey,
    tracingHelper,
    logLevel,
    logQueries,
    engineHash,
  }: {
    apiKey: string
    tracingHelper: TracingHelper
    logLevel: EngineConfig['logLevel']
    logQueries: boolean | undefined
    engineHash: string
  }) {
    this.apiKey = apiKey
    this.tracingHelper = tracingHelper
    this.logLevel = logLevel
    this.logQueries = logQueries
    this.engineHash = engineHash
  }

  build({ traceparent, interactiveTransaction }: HeaderBuilderOptions = {}): DataProxyHeaders {
    const headers: DataProxyHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
      'Prisma-Engine-Hash': this.engineHash,
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

export class DataProxyEngine implements Engine<DataProxyTxInfoPayload> {
  name = 'DataProxyEngine' as const

  private inlineSchema: string
  readonly inlineSchemaHash: string
  private inlineDatasources: EngineConfig['inlineDatasources']
  private config: EngineConfig
  private logEmitter: LogEmitter
  private env: { [k in string]?: string }

  private clientVersion: string
  private engineHash: string
  private tracingHelper: TracingHelper
  private remoteClientVersion!: string
  private host!: string
  private headerBuilder!: DataProxyHeaderBuilder
  private startPromise?: Promise<void>

  constructor(config: EngineConfig) {
    checkForbiddenMetrics(config)

    this.config = config
    this.env = { ...config.env, ...(typeof process !== 'undefined' ? process.env : {}) }
    // TODO (perf) schema should be uploaded as-is
    this.inlineSchema = toBase64(config.inlineSchema)
    this.inlineDatasources = config.inlineDatasources
    this.inlineSchemaHash = config.inlineSchemaHash
    this.clientVersion = config.clientVersion
    this.engineHash = config.engineVersion
    this.logEmitter = config.logEmitter
    this.tracingHelper = config.tracingHelper
  }

  apiKey(): string {
    return this.headerBuilder.apiKey
  }

  // The version is the engine hash
  // that we expect to have on the remote QE
  version() {
    return this.engineHash
  }

  /**
   * This is not a real "start" method, but rather a deferred initialization. We
   * will only parse the URL on the first request to match the behavior of other
   * engines, they will only throw errors on their very first request. This is
   * needed in case the URL is misconfigured.
   */
  async start() {
    if (this.startPromise !== undefined) {
      await this.startPromise
    }

    this.startPromise = (async () => {
      const [host, apiKey] = this.extractHostAndApiKey()

      this.host = host
      this.headerBuilder = new DataProxyHeaderBuilder({
        apiKey,
        tracingHelper: this.tracingHelper,
        logLevel: this.config.logLevel,
        logQueries: this.config.logQueries,
        engineHash: this.engineHash,
      })

      this.remoteClientVersion = await getClientVersion(host, this.config)

      debug('host', this.host)
    })()

    await this.startPromise
  }

  async stop() {}

  private propagateResponseExtensions(extensions: QueryEngineResultExtensions): void {
    if (extensions?.logs?.length) {
      extensions.logs.forEach((log) => {
        switch (log.level) {
          case 'debug':
          case 'trace':
            debug(log)
            break

          case 'error':
          case 'warn':
          case 'info': {
            this.logEmitter.emit(log.level, {
              timestamp: dateFromEngineTimestamp(log.timestamp),
              message: log.attributes.message ?? '',
              target: log.target,
            })
            break
          }

          case 'query': {
            this.logEmitter.emit('query', {
              query: log.attributes.query ?? '',
              // first part is in seconds, second is in nanoseconds, we need to convert both to milliseconds
              timestamp: dateFromEngineTimestamp(log.timestamp),
              duration: log.attributes.duration_ms ?? 0,
              params: log.attributes.params ?? '',
              target: log.target,
            })

            break
          }

          default:
            log.level satisfies never
        }
      })
    }

    if (extensions?.traces?.length) {
      this.tracingHelper.dispatchEngineSpans(extensions.traces)
    }
  }

  onBeforeExit() {
    throw new Error('"beforeExit" hook is not applicable to the remote query engine')
  }

  private async url(action: string) {
    await this.start()

    return `https://${this.host}/${this.remoteClientVersion}/${this.inlineSchemaHash}/${action}`
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

      const error = await responseToError(response, this.clientVersion)

      if (error) {
        this.logEmitter.emit('warn', {
          message: `Error while uploading schema: ${error.message}`,
          timestamp: new Date(),
          target: '',
        })
        throw error
      }
      this.logEmitter.emit('info', {
        message: `Schema (re)uploaded (hash: ${this.inlineSchemaHash})`,
        timestamp: new Date(),
        target: '',
      })
    })
  }

  request<T>(
    query: JsonQuery,
    { traceparent, interactiveTransaction, customDataProxyFetch }: RequestOptions<DataProxyTxInfoPayload>,
  ) {
    return this.requestInternal<T>({
      body: query,
      traceparent,
      interactiveTransaction,
      customDataProxyFetch,
    })
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { traceparent, transaction, customDataProxyFetch }: RequestBatchOptions<DataProxyTxInfoPayload>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    const interactiveTransaction = transaction?.kind === 'itx' ? transaction.options : undefined

    const body = getBatchRequestPayload(queries, transaction)

    const batchResult = await this.requestInternal<T, true>({
      body,
      customDataProxyFetch,
      interactiveTransaction,
      traceparent,
    })

    return batchResult.map((result) => {
      if (result.extensions) {
        this.propagateResponseExtensions(result.extensions)
      }

      if ('errors' in result) {
        return this.convertProtocolErrorsToClientError(result.errors)
      }

      return result
    })
  }

  private requestInternal<T, Batch extends boolean = false>({
    body,
    traceparent,
    customDataProxyFetch,
    interactiveTransaction,
  }: RequestInternalOptions): Promise<Batch extends true ? QueryEngineResult<T>[] : QueryEngineResultData<T>> {
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

        await this.handleError(await responseToError(response, this.clientVersion))

        const result = (await response.json()) as Batch extends true ? QueryEngineBatchResult<T> : QueryEngineResult<T>

        if (result.extensions) {
          this.propagateResponseExtensions(result.extensions)
        }

        if ('errors' in result) {
          throw this.convertProtocolErrorsToClientError(result.errors)
        }

        if ('batchResult' in result) {
          // TODO: TypeScript 5.8+ should be able to narrow the expected result type correctly,
          // so this will be assignable (https://github.com/microsoft/TypeScript/pull/56941).
          // Since these are internal types, we should be able to rely on it once TypeScript 5.8
          // is released, and change this to just `return result.batchResult`.
          return result.batchResult as QueryEngineResult<T>[] as Batch extends true
            ? QueryEngineResult<T>[]
            : QueryEngineResultData<T>
        }

        // TODO: TypeScript 5.8+ should be able to narrow the expected result type correctly,
        // so this will be assignable (https://github.com/microsoft/TypeScript/pull/56941).
        // Since these are internal types, we should be able to rely on it once TypeScript 5.8
        // is released, and change this to just `return result`.
        return result as QueryEngineResultData<T> as Batch extends true
          ? QueryEngineResult<T>[]
          : QueryEngineResultData<T>
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
  transaction(action: 'start', headers: Tx.TransactionHeaders, options: Tx.Options): Promise<DataProxyTxInfo>
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
            max_wait: arg.maxWait,
            timeout: arg.timeout,
            isolation_level: arg.isolationLevel,
          })

          const url = await this.url('transaction/start')

          logHttpCall(url)

          const response = await request(url, {
            method: 'POST',
            headers: this.headerBuilder.build({ traceparent: headers.traceparent }),
            body,
            clientVersion: this.clientVersion,
          })

          await this.handleError(await responseToError(response, this.clientVersion))

          const result = (await response.json()) as StartTransactionResult

          const { extensions } = result
          if (extensions) {
            this.propagateResponseExtensions(extensions)
          }

          const id = result.id as string
          const endpoint = result['data-proxy'].endpoint as string

          return { id, payload: { endpoint } }
        }
        const url = `${arg.payload.endpoint}/${action}`

        logHttpCall(url)

        const response = await request(url, {
          method: 'POST',
          headers: this.headerBuilder.build({ traceparent: headers.traceparent }),
          clientVersion: this.clientVersion,
        })

        await this.handleError(await responseToError(response, this.clientVersion))

        const result = (await response.json()) as CloseTransactionResult

        const { extensions } = result
        if (extensions) {
          this.propagateResponseExtensions(extensions)
        }

        return undefined
      },
    })
  }

  private extractHostAndApiKey() {
    const errorInfo = { clientVersion: this.clientVersion }
    const dsName = Object.keys(this.inlineDatasources)[0]
    const serviceURL = resolveDatasourceUrl({
      inlineDatasources: this.inlineDatasources,
      overrideDatasources: this.config.overrideDatasources,
      clientVersion: this.clientVersion,
      env: this.env,
    })

    let url: URL
    try {
      url = new URL(serviceURL)
    } catch {
      throw new InvalidDatasourceError(
        `Error validating datasource \`${dsName}\`: the URL must start with the protocol \`prisma://\``,
        errorInfo,
      )
    }

    const { protocol, host, searchParams } = url

    if (protocol !== 'prisma:' && protocol !== PRISMA_POSTGRES_PROTOCOL) {
      throw new InvalidDatasourceError(
        `Error validating datasource \`${dsName}\`: the URL must start with the protocol \`prisma://\``,
        errorInfo,
      )
    }

    const apiKey = searchParams.get('api_key')
    if (apiKey === null || apiKey.length < 1) {
      throw new InvalidDatasourceError(
        `Error validating datasource \`${dsName}\`: the URL must contain a valid API key`,
        errorInfo,
      )
    }

    return [host, apiKey]
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(): Promise<Metrics> | Promise<string> {
    throw new NotImplementedYetError('Metrics are not yet supported for Accelerate', {
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
          timestamp: new Date(),
          target: '',
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
          }
          throw e
        }

        this.logEmitter.emit('warn', {
          message: `Attempt ${attempt + 1}/${MAX_RETRIES} failed for ${args.actionGerund}: ${e.message ?? '(unknown)'}`,
          timestamp: new Date(),
          target: '',
        })

        const delay = await backOff(attempt)

        this.logEmitter.emit('warn', {
          message: `Retrying after ${delay}ms`,
          timestamp: new Date(),
          target: '',
        })
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
    }
    if (error) {
      throw error
    }
  }

  private convertProtocolErrorsToClientError(
    errors: RequestError[],
  ): PrismaClientKnownRequestError | PrismaClientUnknownRequestError {
    // TODO: handle Rust panics and driver adapter errors correctly. See `LibraryEngine#buildQueryError`.
    if (errors.length === 1) {
      return prismaGraphQLToJSError(errors[0], this.config.clientVersion, this.config.activeProvider!)
    }
    return new PrismaClientUnknownRequestError(JSON.stringify(errors), {
      clientVersion: this.config.clientVersion,
    })
  }

  applyPendingMigrations(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
