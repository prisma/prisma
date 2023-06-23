import { setClassName } from '@prisma/internals'

import type { RequestResponse } from '../utils/request'
import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface NotFoundErrorInfo extends DataProxyAPIErrorInfo {
  response: RequestResponse
}

export const NOT_FOUND_DEFAULT_MESSAGE = 'Requested resource does not exist'

export class NotFoundError extends DataProxyAPIError {
  public name = 'NotFoundError'
  public code = 'P5003'

  constructor(info: NotFoundErrorInfo, message = NOT_FOUND_DEFAULT_MESSAGE) {
    super(message, setRetryable(info, false))
  }
}
setClassName(NotFoundError, 'NotFoundError')
