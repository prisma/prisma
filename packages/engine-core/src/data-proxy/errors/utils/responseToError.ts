import type { RequestResponse } from '../../utils/request'
import { BadRequestError } from '../BadRequestError'
import type { DataProxyError } from '../DataProxyError'
import { GatewayTimeoutError } from '../GatewayTimeoutError'
import { NotFoundError } from '../NotFoundError'
import { SchemaMissingError } from '../SchemaMissingError'
import { ServerError } from '../ServerError'
import { UnauthorizedError } from '../UnauthorizedError'
import { UsageExceededError } from '../UsageExceededError'

export async function responseToError(
  response: RequestResponse,
  clientVersion: string,
): Promise<DataProxyError | undefined> {
  if (response.ok) return undefined

  const info = { clientVersion, response }

  // Explicitly handle 400 errors which contain known errors
  if (response.status === 400) {
    let knownError
    try {
      const body = await response.json()
      knownError = body?.EngineNotStarted?.reason?.KnownEngineStartupError
    } catch (_) {}

    if (knownError) {
      throw new BadRequestError(info, knownError.msg, knownError.error_code)
    }
  }

  if (response.status === 401) {
    throw new UnauthorizedError(info)
  }

  if (response.status === 404) {
    try {
      const body = await response.json()
      const isSchemaMissing = body?.EngineNotStarted?.reason === 'SchemaMissing'

      return isSchemaMissing ? new SchemaMissingError(info) : new NotFoundError(info)
    } catch (err) {
      return new NotFoundError(info)
    }
  }

  if (response.status === 429) {
    throw new UsageExceededError(info)
  }

  if (response.status === 504) {
    throw new GatewayTimeoutError(info)
  }

  if (response.status >= 500) {
    let body
    try {
      body = await response.json()
    } catch (err) {
      throw new ServerError(info)
    }

    if (typeof body?.EngineNotStarted?.reason === 'string') {
      throw new ServerError(info, body.EngineNotStarted.reason)
    } else if (typeof body?.EngineNotStarted?.reason === 'object') {
      const keys = Object.keys(body.EngineNotStarted.reason)
      if (keys.length > 0) {
        const reason = body.EngineNotStarted.reason
        const content = reason[keys[0]]
        throw new ServerError(info, keys[0], content.logs)
      }
    }

    throw new ServerError(info)
  }

  if (response.status >= 400) {
    throw new BadRequestError(info)
  }

  return undefined
}
