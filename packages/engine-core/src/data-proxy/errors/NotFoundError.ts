import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from './request'

export class NotFoundError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Requested resource does not exist.', false)
  }
}
