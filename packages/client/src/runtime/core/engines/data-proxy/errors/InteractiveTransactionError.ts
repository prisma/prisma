import { setClassName } from '@prisma/internals'

import type { RequestResponse } from '../utils/request'
import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface InteractiveTransactionErrorInfo extends DataProxyAPIErrorInfo {
  response: RequestResponse
}

export const INTERACTIVE_TRANSACTION_ERROR_DEFAULT_MESSAGE = 'Interactive transaction error'

export class InteractiveTransactionError extends DataProxyAPIError {
  public name = 'InteractiveTransactionError'
  public code = 'P5015'

  constructor(info: InteractiveTransactionErrorInfo, message = INTERACTIVE_TRANSACTION_ERROR_DEFAULT_MESSAGE) {
    super(message, setRetryable(info, false))
  }
}
setClassName(InteractiveTransactionError, 'InteractiveTransactionError')
