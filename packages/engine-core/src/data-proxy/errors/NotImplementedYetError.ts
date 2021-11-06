import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import { setRetryable } from './utils/setRetryable'

export interface NotImplementedYetErrorInfo extends DataProxyErrorInfo {}

export class NotImplementedYetError extends DataProxyError {
  public name = 'NotImplementedYetError'
  public code = 'P5004'

  constructor(message: string, info: NotImplementedYetErrorInfo) {
    super(message, setRetryable(info, false))
  }
}
