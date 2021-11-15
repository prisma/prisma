import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface BadRequestErrorInfo extends DataProxyAPIErrorInfo {}

export class BadRequestError extends DataProxyAPIError {
  public name = 'BadRequestError'
  public code = 'P5000'

  constructor(info: BadRequestErrorInfo) {
    super('This request could not be understood by the server', setRetryable(info, false))
  }
}
