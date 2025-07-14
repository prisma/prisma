import type { QueryEngineLogLevel } from '@prisma/client-common'
import type { TransactionOptions } from '@prisma/client-engine-runtime'
import { Debug } from '@prisma/debug'
import type { EngineTraceEvent, TracingHelper } from '@prisma/internals'
import { parseSetCookie, serialize as serializeCookie } from 'cookie-es'

import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { getUrlAndApiKey } from '../common/accelerate/getUrlAndApiKey'
import { type AccelerateHeaders, HeaderBuilder } from '../common/accelerate/HeaderBuilder'
import type { EngineConfig } from '../common/Engine'
import type { LogEmitter } from '../common/types/Events'
import type { QueryEngineResultExtensions } from '../common/types/QueryEngine'
import type { InteractiveTransactionInfo } from '../common/types/Transaction'
import { dateFromEngineTimestamp } from '../data-proxy/utils/EngineTimestamp'
import type { ExecutePlanParams, Executor, ProviderAndConnectionInfo } from './Executor'

const debug = Debug('prisma:client:clientEngine:remoteExecutor')

export interface RemoteExecutorOptions {
  clientVersion: string
  logEmitter: LogEmitter
  logLevel: QueryEngineLogLevel
  logQueries: boolean
  tracingHelper: TracingHelper
  inlineDatasources: EngineConfig['inlineDatasources']
  overrideDatasources: EngineConfig['overrideDatasources']
  env: Record<string, string | undefined>
}

export class RemoteExecutor implements Executor {
  readonly #clientVersion: string
  readonly #headerBuilder: HeaderBuilder
  readonly #httpClient: HttpClient
  readonly #logEmitter: LogEmitter
  readonly #tracingHelper: TracingHelper

  constructor(options: RemoteExecutorOptions) {
    this.#clientVersion = options.clientVersion
    this.#logEmitter = options.logEmitter
    this.#tracingHelper = options.tracingHelper

    const { url, apiKey } = getUrlAndApiKey({
      clientVersion: options.clientVersion,
      env: options.env,
      inlineDatasources: options.inlineDatasources,
      overrideDatasources: options.overrideDatasources,
    })

    this.#httpClient = new HttpClient(url)

    this.#headerBuilder = new HeaderBuilder({
      apiKey,
      engineHash: options.clientVersion,
      logLevel: options.logLevel,
      logQueries: options.logQueries,
      tracingHelper: options.tracingHelper,
    })
  }

  async getConnectionInfo(): Promise<ProviderAndConnectionInfo> {
    const connInfo = await this.#request({
      path: '/connection-info',
      method: 'GET',
    })
    return connInfo as ProviderAndConnectionInfo
  }

  async execute({
    plan,
    placeholderValues,
    batchIndex,
    model,
    operation,
    transaction,
    customFetch,
  }: ExecutePlanParams): Promise<unknown> {
    const response = await this.#request({
      path: transaction ? `/transaction/${transaction.id}/query` : '/query',
      method: 'POST',
      body: {
        model,
        operation,
        plan,
        params: placeholderValues,
      },
      batchRequestIdx: batchIndex,
      fetch: customFetch,
    })

    return (response as Record<string, unknown>).data
  }

  async startTransaction(options: TransactionOptions): Promise<InteractiveTransactionInfo> {
    const txInfo = (await this.#request({
      path: '/transaction/start',
      method: 'POST',
      body: options,
    })) as { id: string }

    return { ...txInfo, payload: undefined }
  }

  async commitTransaction(transaction: InteractiveTransactionInfo): Promise<void> {
    await this.#request({
      path: `/transaction/${transaction.id}/commit`,
      method: 'POST',
    })
  }

  async rollbackTransaction(transaction: InteractiveTransactionInfo): Promise<void> {
    await this.#request({
      path: `/transaction/${transaction.id}/rollback`,
      method: 'POST',
    })
  }

  disconnect(): Promise<void> {
    return Promise.resolve()
  }

  async #request({
    path,
    method,
    body,
    fetch = globalThis.fetch,
    batchRequestIdx,
  }: {
    path: string
    method: string
    body?: unknown
    fetch?: typeof globalThis.fetch
    batchRequestIdx?: number
  }): Promise<unknown> {
    const response = await this.#httpClient.request({
      method,
      path,
      headers: this.#headerBuilder.build(),
      body,
      fetch,
    })

    if (!response.ok) {
      await this.#throwErrorFromResponse(response, batchRequestIdx)
    }

    const responseJson = await response.json()

    if (typeof responseJson.extensions === 'object' && responseJson.extensions !== null) {
      this.#processExtensions(responseJson.extensions as QueryEngineResultExtensions)
    }

    return responseJson
  }

  async #throwErrorFromResponse(response: Response, batchRequestIdx?: number): Promise<never> {
    let errorCode = response.headers.get('Prisma-Error-Code')

    const responseText = await response.text()
    let errorJson: Record<string, unknown>
    let errorMessage = responseText

    try {
      errorJson = JSON.parse(responseText)
    } catch {
      errorJson = {}
    }

    if (typeof errorJson.code === 'string') {
      errorCode = errorJson.code
    }

    if (typeof errorJson.error === 'string') {
      // Query Plan Executor errors
      errorMessage = errorJson.error
    } else if (typeof errorJson.message === 'string') {
      // Accelerate errors
      errorMessage = errorJson.message
    } else if (
      // Certain specific Accelerate errors that mimic the shape of legacy Data Proxy errors
      // for backward compatibility with DataProxyEngine in the Client.
      typeof errorJson.InvalidRequestError === 'object' &&
      errorJson.InvalidRequestError !== null &&
      typeof (errorJson.InvalidRequestError as Record<string, unknown>).reason === 'string'
    ) {
      errorMessage = (errorJson.InvalidRequestError as Record<string, unknown>).reason as string
    }

    errorMessage = errorMessage || `HTTP ${response.status}: ${response.statusText}`

    const errorMeta =
      typeof errorJson.meta === 'object' && errorJson.meta !== null
        ? (errorJson.meta as Record<string, unknown>)
        : errorJson

    throw new PrismaClientKnownRequestError(errorMessage, {
      clientVersion: this.#clientVersion,
      code: errorCode ?? 'P6000',
      batchRequestIdx,
      meta: errorMeta,
    })
  }

  #processExtensions(extensions: QueryEngineResultExtensions): void {
    if (extensions.logs) {
      for (const log of extensions.logs) {
        this.#emitLogEvent(log)
      }
    }
    if (extensions.traces) {
      // FIXME: log events should be emitted in the context of the corresponding
      // spans to be consistent with the normal `ClientEngine` behavior. Our
      // current `TracingHelper` interface makes it challenging to do so.
      // We need to either change `dispatchEngineSpans` to be log-aware, or
      // not use `dispatchEngineSpans` here at all and emit the spans directly.
      // The second option is probably better long term so we can get rid of
      // `dispatchEngineSpans` entirely when QC is in GA and the QE is gone.
      this.#tracingHelper.dispatchEngineSpans(extensions.traces)
    }
  }

  #emitLogEvent(event: EngineTraceEvent): void {
    switch (event.level) {
      case 'debug':
      case 'trace':
        debug(event)
        break

      case 'error':
      case 'warn':
      case 'info': {
        this.#logEmitter.emit(event.level, {
          timestamp: dateFromEngineTimestamp(event.timestamp),
          message: event.attributes.message ?? '',
          target: event.target,
        })
        break
      }

      case 'query': {
        this.#logEmitter.emit('query', {
          query: event.attributes.query ?? '',
          timestamp: dateFromEngineTimestamp(event.timestamp),
          duration: event.attributes.duration_ms ?? 0,
          params: event.attributes.params ?? '',
          target: event.target,
        })

        break
      }

      default:
        throw new Error(`Unexpected log level: ${event.level satisfies never}`)
    }
  }
}

/**
 * HTTP client with support for cookies and machine hint headers.
 *
 * Accelerate uses cookies to route requests inside interactive transactions to
 * the correct instance.
 */
class HttpClient {
  readonly #baseUrl: URL
  readonly #cookieJar: Map<string, { name: string; value: string; domain: string; path: string; expires?: Date }>
  #machineHint: string | undefined

  constructor(baseUrl: URL) {
    this.#baseUrl = baseUrl
    this.#cookieJar = new Map()
  }

  async request({
    method,
    path,
    headers,
    body,
    fetch,
  }: {
    method: string
    path: string
    headers: AccelerateHeaders
    body: unknown
    fetch: typeof globalThis.fetch
  }): Promise<Response> {
    const requestUrl = new URL(path, this.#baseUrl)

    const cookieHeader = this.#getCookieHeader(requestUrl)
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader
    }

    if (this.#machineHint) {
      headers['Accelerate-Query-Engine-Jwt'] = this.#machineHint
    }

    const response = await fetch(requestUrl, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    })

    debug(method, requestUrl, response.status, response.statusText)

    this.#machineHint = response.headers.get('Accelerate-Query-Engine-Jwt') ?? undefined
    this.#storeCookiesFromResponse(requestUrl, response)

    return response
  }

  #getCookieHeader(url: URL): string | undefined {
    const validCookies: string[] = []
    const now = new Date()

    for (const [key, cookie] of this.#cookieJar) {
      if (cookie.expires && cookie.expires < now) {
        this.#cookieJar.delete(key)
        continue
      }

      const domain = cookie.domain ?? url.hostname
      const path = cookie.path ?? '/'

      if (url.hostname.endsWith(domain) && url.pathname.startsWith(path)) {
        validCookies.push(serializeCookie(cookie.name, cookie.value))
      }
    }

    return validCookies.length > 0 ? validCookies.join('; ') : undefined
  }

  #storeCookiesFromResponse(url: URL, response: Response): void {
    // Try to get Set-Cookie headers using the modern API first
    const setCookieHeaders = response.headers.getSetCookie?.() || []

    // Fallback to the traditional method if getSetCookie is not available
    if (setCookieHeaders.length === 0) {
      const setCookieHeader = response.headers.get('Set-Cookie')
      if (setCookieHeader) {
        setCookieHeaders.push(setCookieHeader)
      }
    }

    for (const cookieString of setCookieHeaders) {
      const cookie = parseSetCookie(cookieString)

      const domain = cookie.domain ?? url.hostname
      const path = cookie.path ?? '/'
      const key = `${domain}:${path}:${cookie.name}`

      this.#cookieJar.set(key, {
        name: cookie.name,
        value: cookie.value,
        domain,
        path,
        expires: cookie.expires,
      })
    }
  }
}
