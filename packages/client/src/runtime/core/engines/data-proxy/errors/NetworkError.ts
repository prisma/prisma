import { setClassName } from '@prisma/internals'

import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import { setRetryable } from './utils/setRetryable'

export interface RequestErrorInfo extends DataProxyErrorInfo {}

export class RequestError extends DataProxyError {
  public name = 'RequestError'
  public code = 'P5010'

  constructor(message: string, info: RequestErrorInfo) {
    super(`Cannot fetch data from service:\n${message}`, setRetryable(info, true))
  }
}
setClassName(RequestError, 'RequestError')
