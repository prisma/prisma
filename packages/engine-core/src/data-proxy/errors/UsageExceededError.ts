import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface UsageExceededErrorInfo extends DataProxyAPIErrorInfo {}

export class UsageExceededError extends DataProxyAPIError {
  public code = 'P5008'

  constructor(info: UsageExceededErrorInfo) {
    super('Usage exceeded, retry again later', setRetryable(info, true))
  }
}
