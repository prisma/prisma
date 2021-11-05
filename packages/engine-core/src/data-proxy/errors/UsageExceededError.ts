import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from './request'

export class UsageExceededError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Usage exceeded. This request can be retried later.', true)
  }
}
