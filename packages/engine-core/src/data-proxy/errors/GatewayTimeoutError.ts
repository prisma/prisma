import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface GatewayTimeoutErrorInfo extends DataProxyAPIErrorInfo {}

export class GatewayTimeoutError extends DataProxyAPIError {
  public name = 'GatewayTimeoutError'
  public code = 'P5009'

  constructor(info: GatewayTimeoutErrorInfo) {
    super('Request timed out', setRetryable(info, false))
  }
}
