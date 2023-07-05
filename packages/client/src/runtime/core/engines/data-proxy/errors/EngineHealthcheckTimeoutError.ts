import { setClassName } from '@prisma/internals'

import type { RequestResponse } from '../utils/request'
import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface HealthcheckTimeoutErrorInfo extends DataProxyAPIErrorInfo {
  response: RequestResponse
}

export class HealthcheckTimeoutError extends DataProxyAPIError {
  public name = 'HealthcheckTimeoutError'
  public code = 'P5013'
  public logs: string[]

  constructor(info: HealthcheckTimeoutErrorInfo, logs: string[]) {
    super('Engine not started: healthcheck timeout', setRetryable(info, true))
    this.logs = logs
  }
}
setClassName(HealthcheckTimeoutError, 'HealthcheckTimeoutError')
