import { BadRequestError } from '../BadRequestError'
import type { DataProxyError } from '../DataProxyError'
import { NotFoundError } from '../NotFoundError'
import type { RequestResponse } from '../../utils/request'
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

  if (response.status >= 500) {
    throw new ServerError(info)
  }

  if (response.status >= 400) {
    throw new BadRequestError(info)
  }

  return undefined
}
