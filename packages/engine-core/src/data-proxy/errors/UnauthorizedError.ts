import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface UnauthorizedErrorInfo extends DataProxyAPIErrorInfo {}

export class UnauthorizedError extends DataProxyAPIError {
  public code = 'P5007'

  constructor(info: UnauthorizedErrorInfo) {
    super('Could not authorize this request. Check your Data Proxy connection string.', setRetryable(info, false))
  }
}
