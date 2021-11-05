import { BadRequestError } from '../BadRequestError'
import type { DataProxyError } from '../DataProxyError'
import { NotFoundError } from '../NotFoundError'
import type { RequestResponse } from '../../utils/request'
import { SchemaMissingError } from '../SchemaMissingError'
import { ServerError } from '../ServerError'
import { UnauthorizedError } from '../UnauthorizedError'
import { UsageExceededError } from '../UsageExceededError'

export async function responseToError(res: RequestResponse): Promise<DataProxyError | undefined> {
  if (res.ok) return undefined

  if (res.status === 401) {
    throw new UnauthorizedError(res)
  }

  if (res.status === 404) {
    try {
      const body = await res.json()
      const isSchemaMissing = body?.EngineNotStarted?.reason === 'SchemaMissing'

      return isSchemaMissing ? new SchemaMissingError(res) : new NotFoundError(res)
    } catch (err) {
      return new NotFoundError(res)
    }
  }

  if (res.status === 429) {
    throw new UsageExceededError(res)
  }

  if (res.status >= 500) {
    throw new ServerError(res)
  }

  if (res.status >= 400) {
    throw new BadRequestError(res)
  }

  return undefined
}
