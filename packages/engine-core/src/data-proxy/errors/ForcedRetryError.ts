import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import { setRetryable } from './utils/setRetryable'

export interface ForcedRetryErrorInfo extends DataProxyErrorInfo {}

export class ForcedRetryError extends DataProxyError {
  public name = 'ForcedRetryError'
  public code = 'P5001'

  constructor(info: ForcedRetryErrorInfo) {
    super('This request must be retried', setRetryable(info, true))
  }
}
