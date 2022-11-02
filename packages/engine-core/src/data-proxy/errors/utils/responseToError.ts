import { PrismaClientInitializationError } from '../../../common/errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../../common/errors/PrismaClientKnownRequestError'
import type { RequestResponse } from '../../utils/request'
import { BAD_REQUEST_DEFAULT_MESSAGE, BadRequestError } from '../BadRequestError'
import type { DataProxyError } from '../DataProxyError'
import { HealthcheckTimeoutError } from '../EngineHealthcheckTimeoutError'
import { EngineStartupError } from '../EngineStartupError'
import { EngineVersionNotSupportedError } from '../EngineVersionNotSupportedError'
import { GATEWAY_TIMEOUT_DEFAULT_MESSAGE, GatewayTimeoutError } from '../GatewayTimeoutError'
import { InteractiveTransactionError } from '../InteractiveTransactionError'
import { InvalidRequestError } from '../InvalidRequestError'
import { NOT_FOUND_DEFAULT_MESSAGE, NotFoundError } from '../NotFoundError'
import { SchemaMissingError } from '../SchemaMissingError'
import { SERVER_ERROR_DEFAULT_MESSAGE, ServerError } from '../ServerError'
import { UNAUTHORIZED_DEFAULT_MESSAGE, UnauthorizedError } from '../UnauthorizedError'
import { USAGE_EXCEEDED_DEFAULT_MESSAGE, UsageExceededError } from '../UsageExceededError'

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
        throw new EngineVersionNotSupportedError(info)
      }
      if ('EngineStartupError' in error.error.EngineNotStarted.reason) {
        const { msg, logs } = error.error.EngineNotStarted.reason.EngineStartupError
        throw new EngineStartupError(info, msg, logs)
      }
      if ('KnownEngineStartupError' in error.error.EngineNotStarted.reason) {
        const { msg, error_code } = error.error.EngineNotStarted.reason.KnownEngineStartupError
        throw new PrismaClientInitializationError(msg, clientVersion, error_code)
      }
      if ('HealthcheckTimeout' in error.error.EngineNotStarted.reason) {
        const { logs } = error.error.EngineNotStarted.reason.HealthcheckTimeout
        throw new HealthcheckTimeoutError(info, logs)
      }
    }

    if ('InteractiveTransactionMisrouted' in error.error) {
      const messageByReason: Record<InteractiveTransactionMisroutedReason, string> = {
        IDParseError: 'Could not parse interactive transaction ID',
        NoQueryEngineFoundError: 'Could not find Query Engine for the specified host and transaction ID',
        TransactionStartError: 'Could not start interactive transaction',
      }
      throw new InteractiveTransactionError(info, messageByReason[error.error.InteractiveTransactionMisrouted.reason])
    }

    if ('InvalidRequestError' in error.error) {
      throw new InvalidRequestError(info, error.error.InvalidRequestError.reason)
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError(info, buildErrorMessage(UNAUTHORIZED_DEFAULT_MESSAGE, error))
  }

  if (response.status === 404) {
    return new NotFoundError(info, buildErrorMessage(NOT_FOUND_DEFAULT_MESSAGE, error))
  }

  if (response.status === 429) {
    throw new UsageExceededError(info, buildErrorMessage(USAGE_EXCEEDED_DEFAULT_MESSAGE, error))
  }

  if (response.status === 504) {
    throw new GatewayTimeoutError(info, buildErrorMessage(GATEWAY_TIMEOUT_DEFAULT_MESSAGE, error))
  }

  if (response.status >= 500) {
    throw new ServerError(info, buildErrorMessage(SERVER_ERROR_DEFAULT_MESSAGE, error))
  }

  if (response.status >= 400) {
    throw new BadRequestError(info, buildErrorMessage(BAD_REQUEST_DEFAULT_MESSAGE, error))
  }

  return undefined
}

function buildErrorMessage(defaultMessage: string, errorBody: ResponseErrorBody): string {
  if (errorBody.type === 'EmptyError') {
    return defaultMessage
  }
  return `${defaultMessage}: ${JSON.stringify(errorBody)}`
}
