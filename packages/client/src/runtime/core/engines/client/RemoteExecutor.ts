import type { QueryEngineLogLevel } from '@prisma/client-common'
import type { TransactionOptions } from '@prisma/client-engine-runtime'
import type { ConnectionInfo } from '@prisma/driver-adapter-utils'
import type { TracingHelper } from '@prisma/internals'

import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { getUrlAndApiKey } from '../common/accelerate/getUrlAndApiKey'
import { HeaderBuilder } from '../common/accelerate/HeaderBuilder'
import { EngineConfig } from '../common/Engine'
import type { LogEmitter } from '../common/types/Events'
import type { InteractiveTransactionInfo } from '../common/types/Transaction'
import type { ExecutePlanParams, Executor } from './Executor'

interface AccelerateTransactionInfoPayload {
  cookie: string
}

type AccelerateTransactionInfo = InteractiveTransactionInfo<AccelerateTransactionInfoPayload>

function assertAccelerateTransactionInfo(
  transaction: InteractiveTransactionInfo,
): asserts transaction is AccelerateTransactionInfo {
  if (typeof (transaction as AccelerateTransactionInfo).payload?.cookie !== 'string') {
    throw new Error('Invalid transaction payload')
  }
}

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
  readonly #url: URL

  constructor(options: RemoteExecutorOptions) {
    this.#clientVersion = options.clientVersion

    const { url, apiKey } = getUrlAndApiKey({
      clientVersion: options.clientVersion,
      env: options.env,
      inlineDatasources: options.inlineDatasources,
      overrideDatasources: options.overrideDatasources,
    })

    this.#url = url

    this.#headerBuilder = new HeaderBuilder({
      apiKey,
      engineHash: options.clientVersion,
      logLevel: options.logLevel,
      logQueries: options.logQueries,
      tracingHelper: options.tracingHelper,
    })
  }

  async getConnectionInfo(): Promise<ConnectionInfo> {
    const connInfo = await this.#request({
      path: '/connection-info',
      method: 'GET',
    })
    return connInfo as ConnectionInfo
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
    // TODO: logs, tracing, use correct transaction endpoint
    return await this.#request({
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
  }

  async startTransaction(options: TransactionOptions): Promise<AccelerateTransactionInfo> {
    // TODO: logs, tracing
    const txInfo = (await this.#request({
      path: '/transaction/start',
      method: 'POST',
      body: options,
    })) as { id: string }

    return { ...txInfo, payload: { cookie: 'TODO' } }
  }

  async commitTransaction(transaction: InteractiveTransactionInfo): Promise<void> {
    // TODO: logs, tracing, use correct transaction endpoint
    assertAccelerateTransactionInfo(transaction)

    await this.#request({
      path: `/transaction/${transaction.id}/commit`,
      method: 'POST',
    })
  }

  async rollbackTransaction(transaction: InteractiveTransactionInfo): Promise<void> {
    // TODO: logs, tracing, use correct transaction endpoint
    assertAccelerateTransactionInfo(transaction)

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
    const response = await fetch(new URL(path, this.#url), {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: this.#headerBuilder.build(),
    })

    if (!response.ok) {
      await this.#throwErrorFromResponse(response, batchRequestIdx)
    }

    return await response.json()
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
      errorCode = errorCode ?? errorJson.code
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

    throw new PrismaClientKnownRequestError(errorMessage, {
      clientVersion: this.#clientVersion,
      code: errorCode ?? 'P6000',
      batchRequestIdx,
      meta: errorJson,
    })
  }
}
