import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from './request'

export class UnauthorizedError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Could not authorize this request. Check your Data Proxy connection string.', false)
  }
}
