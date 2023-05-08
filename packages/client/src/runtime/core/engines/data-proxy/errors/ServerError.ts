import { setClassName } from '@prisma/internals'

import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface ServerErrorInfo extends DataProxyAPIErrorInfo {}

export const SERVER_ERROR_DEFAULT_MESSAGE = 'Unknown server error'

export class ServerError extends DataProxyAPIError {
  public name = 'ServerError'
  public code = 'P5006'
  public logs?: string[]

  constructor(info: ServerErrorInfo, message?: string, logs?: string[]) {
    super(message || SERVER_ERROR_DEFAULT_MESSAGE, setRetryable(info, true))
    this.logs = logs
  }
}
setClassName(ServerError, 'ServerError')
