import { setClassName } from '@prisma/internals'

import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface BadRequestErrorInfo extends DataProxyAPIErrorInfo {}

export const BAD_REQUEST_DEFAULT_MESSAGE = 'This request could not be understood by the server'

export class BadRequestError extends DataProxyAPIError {
  public name = 'BadRequestError'
  public code = 'P5000'

  constructor(info: BadRequestErrorInfo, message?: string, code?: string) {
    super(message || BAD_REQUEST_DEFAULT_MESSAGE, setRetryable(info, false))
    if (code) this.code = code
  }
}
setClassName(BadRequestError, 'BadRequestError')
