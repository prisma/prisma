import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import { setRetryable } from './utils/setRetryable'

export interface NetworkErrorInfo extends DataProxyErrorInfo {}

export class NetworkError extends DataProxyError {
  public name = 'NetworkError'
  public code = 'P5010'

  constructor(info: NetworkErrorInfo) {
    super('Cannot fetch data from service', setRetryable(info, true))
  }
}
