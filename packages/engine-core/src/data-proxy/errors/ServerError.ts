import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface ServerErrorInfo extends DataProxyAPIErrorInfo {}

export class ServerError extends DataProxyAPIError {
  public code = 'P5006'

  constructor(info: ServerErrorInfo) {
    super('Unknown server error', setRetryable(info, true))
  }
}
