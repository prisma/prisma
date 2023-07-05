import { setClassName } from '@prisma/internals'

import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface UnauthorizedErrorInfo extends DataProxyAPIErrorInfo {}

export const UNAUTHORIZED_DEFAULT_MESSAGE = 'Unauthorized, check your connection string'

export class UnauthorizedError extends DataProxyAPIError {
  public name = 'UnauthorizedError'
  public code = 'P5007'

  constructor(info: UnauthorizedErrorInfo, message = UNAUTHORIZED_DEFAULT_MESSAGE) {
    super(message, setRetryable(info, false))
  }
}
setClassName(UnauthorizedError, 'UnauthorizedError')
