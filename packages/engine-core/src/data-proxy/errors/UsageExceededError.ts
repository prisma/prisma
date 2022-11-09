import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface UsageExceededErrorInfo extends DataProxyAPIErrorInfo {}

export const USAGE_EXCEEDED_DEFAULT_MESSAGE = 'Usage exceeded, retry again later'

export class UsageExceededError extends DataProxyAPIError {
  public name = 'UsageExceededError'
  public code = 'P5008'

  constructor(info: UsageExceededErrorInfo, message = USAGE_EXCEEDED_DEFAULT_MESSAGE) {
    super(message, setRetryable(info, true))
  }
}
