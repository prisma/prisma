import { PrismaClientInitializationError } from '../../../common/errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../../common/errors/PrismaClientKnownRequestError'
import type { RequestResponse } from '../../utils/request'
import { BadRequestError } from '../BadRequestError'
import type { DataProxyError } from '../DataProxyError'
import { GatewayTimeoutError } from '../GatewayTimeoutError'
import { NotFoundError } from '../NotFoundError'
import { SchemaMissingError } from '../SchemaMissingError'
import { ServerError } from '../ServerError'
import { UnauthorizedError } from '../UnauthorizedError'
import { UsageExceededError } from '../UsageExceededError'

type DataProxyHttpError =
  | 'InternalDataProxyError'
  | { EngineNotStarted: { reason: EngineNotStartedReason } }
  | { InteractiveTransactionMisrouted: { reason: InteractiveTransactionMisroutedReason } }
  | { InvalidRequestError: { reason: string } }

type EngineNotStartedReason =
  | 'SchemaMissing'
  | 'EngineVersionNotSupported'
  | { EngineStartupError: { msg: string; logs: string[] } }
  | { KnownEngineStartupError: { msg: string; error_code: string } }
  | { HealthcheckTimeout: { logs: string[] } }

type InteractiveTransactionMisroutedReason = 'IDParseError' | 'NoQueryEngineFoundError' | 'TransactionStartError'

type QueryEngineError = {
  is_panic: boolean
  message: string
  error_code: string
}

type ResponseErrorBody =
  | { type: 'DataProxyError'; error: DataProxyHttpError }
  | { type: 'QueryEngineError'; error: QueryEngineError }
  | { type: 'UnknownJsonError'; error: unknown }
  | { type: 'UnknownTextError'; error: string }
  | { type: 'EmptyError' }

async function getResponseErrorBody(response: RequestResponse): Promise<ResponseErrorBody> {
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const text = await response.text()
  try {
    const error = JSON.parse(text)

    if (typeof error === 'string') {
      switch (error) {
        case 'InternalDataProxyError':
          return { type: 'DataProxyError', error }
        default:
          return { type: 'UnknownTextError', error }
      }
    }

    if (typeof error === 'object' && error !== null) {
      if ('is_panic' in error && 'message' in error && 'error_code' in error) {
        return { type: 'QueryEngineError', error }
      }

      if ('EngineNotStarted' in error || 'InteractiveTransactionMisrouted' in error || 'InvalidRequestError' in error) {
        return { type: 'DataProxyError', error }
      }
    }

    return { type: 'UnknownJsonError', error }
  } catch {
    return text === '' ? { type: 'EmptyError' } : { type: 'UnknownTextError', error: text }
  }
}

export async function responseToError(
  response: RequestResponse,
  clientVersion: string,
): Promise<DataProxyError | undefined> {
  if (response.ok) return undefined

  const info = { clientVersion, response }
  const error = await getResponseErrorBody(response)

  if (error.type === 'QueryEngineError') {
    throw new PrismaClientKnownRequestError(error.error.message, error.error.error_code, clientVersion)
  }

  if (error.type === 'DataProxyError') {
    if (error.error === 'InternalDataProxyError') {
      throw new ServerError(info, 'Internal Data Proxy error')
    }

    if ('EngineNotStarted' in error.error) {
      if (error.error.EngineNotStarted.reason === 'SchemaMissing') {
        return new SchemaMissingError(info)
      }
      if (error.error.EngineNotStarted.reason === 'EngineVersionNotSupported') {
        throw new BadRequestError(info, 'Engine version is not supported')
      }
      if ('EngineStartupError' in error.error.EngineNotStarted.reason) {
        const { msg, logs } = error.error.EngineNotStarted.reason.EngineStartupError
        const message = logs.length > 0 ? msg + '\n\nLogs:\n' + logs.join('\n') : msg
        throw new PrismaClientInitializationError(message, clientVersion)
      }
      if ('KnownEngineStartupError' in error.error.EngineNotStarted.reason) {
        const { msg, error_code } = error.error.EngineNotStarted.reason.KnownEngineStartupError
        throw new PrismaClientInitializationError(msg, clientVersion, error_code)
      }
      if ('HealthcheckTimeout' in error.error.EngineNotStarted.reason) {
        const { logs } = error.error.EngineNotStarted.reason.HealthcheckTimeout
        let message = 'Healthcheck timeout'
        if (logs.length > 0) message += '\n\nLogs:\n' + logs.join('\n')
        throw new PrismaClientInitializationError(message, clientVersion)
      }
    }
  }

  if (response.status === 429) {
    throw new UsageExceededError(info)
  }

  if (response.status === 504) {
    throw new GatewayTimeoutError(info)
  }

  if (response.status === 401) {
    throw new UnauthorizedError(info)
  }

  if (response.status === 404) {
    return new NotFoundError(info)
  }

  if (response.status >= 500) {
    throw new ServerError(info, JSON.stringify(error))
  }

  if (response.status >= 400) {
    throw new BadRequestError(info, JSON.stringify(error))
  }

  return undefined
}
