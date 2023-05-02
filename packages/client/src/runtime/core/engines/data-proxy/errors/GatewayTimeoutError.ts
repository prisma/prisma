import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface GatewayTimeoutErrorInfo extends DataProxyAPIErrorInfo {}

export const GATEWAY_TIMEOUT_DEFAULT_MESSAGE = 'Request timed out'

export class GatewayTimeoutError extends DataProxyAPIError {
  public name = 'GatewayTimeoutError'
  public code = 'P5009'

  constructor(info: GatewayTimeoutErrorInfo, message = GATEWAY_TIMEOUT_DEFAULT_MESSAGE) {
    super(message, setRetryable(info, false))
  }
}
