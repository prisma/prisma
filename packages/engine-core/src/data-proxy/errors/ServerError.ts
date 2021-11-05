import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class ServerError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Unknown server error. This request can be retried later.', true)
  }
}
