import { BadRequestError } from '../BadRequestError'
import type { DataProxyError } from '../DataProxyError'
import { NotFoundError } from '../NotFoundError'
import type { RequestResponse } from '../../utils/request'
import { SchemaMissingError } from '../SchemaMissingError'
import { ServerError } from '../ServerError'
import { UnauthorizedError } from '../UnauthorizedError'
import { UsageExceededError } from '../UsageExceededError'

export async function responseToError(response: RequestResponse): Promise<DataProxyError | undefined> {
  if (response.ok) return undefined

  if (response.status === 401) {
    throw new UnauthorizedError(response)
  }

  if (response.status === 404) {
    try {
      const body = await response.json()
      const isSchemaMissing = body?.EngineNotStarted?.reason === 'SchemaMissing'

      return isSchemaMissing ? new SchemaMissingError(response) : new NotFoundError(response)
    } catch (err) {
      return new NotFoundError(response)
    }
  }

  if (response.status === 429) {
    throw new UsageExceededError(response)
  }

  if (response.status >= 500) {
    throw new ServerError(response)
  }

  if (response.status >= 400) {
    throw new BadRequestError(response)
  }

  return undefined
}
