import { setClassName } from '@prisma/internals'

import type { RequestResponse } from '../utils/request'
import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface InvalidRequestErrorInfo extends DataProxyAPIErrorInfo {
  response: RequestResponse
}

export const INVALID_REQUEST_DEFAULT_MESSAGE = 'Request parameters are invalid'

/**
 * Used when the request validation failed.
 * The difference from `BadRequestError` is the latter is used when the server couldn't understand the request,
 * while this error means the server could understand it but rejected due to some parameters being invalid.
 */
export class InvalidRequestError extends DataProxyAPIError {
  public name = 'InvalidRequestError'
  public code = 'P5011'

  constructor(info: InvalidRequestErrorInfo, message = INVALID_REQUEST_DEFAULT_MESSAGE) {
    super(message, setRetryable(info, false))
  }
}
setClassName(InvalidRequestError, 'InvalidRequestError')
