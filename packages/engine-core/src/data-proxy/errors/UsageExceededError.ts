import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class UsageExceededError extends DataProxyAPIError {
  public code = 'P5007'

  constructor(response: RequestResponse) {
    super('Usage exceeded. This request can be retried later.', {
      isRetriable: true,
      response,
    })
  }
}
