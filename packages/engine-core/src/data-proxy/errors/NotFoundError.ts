import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'
import { setRetryable } from './utils/setRetryable'

export interface NotFoundErrorInfo extends DataProxyAPIErrorInfo {
  response: RequestResponse
}

export class NotFoundError extends DataProxyAPIError {
  public code = 'P5003'

  constructor(info: NotFoundErrorInfo) {
    super('Requested resource does not exist', setRetryable(info, false))
  }
}
