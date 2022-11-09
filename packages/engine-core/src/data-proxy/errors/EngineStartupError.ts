import type { RequestResponse } from '../utils/request'
import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface EngineStartupErrorInfo extends DataProxyAPIErrorInfo {
  response: RequestResponse
}

export class EngineStartupError extends DataProxyAPIError {
  public name = 'EngineStartupError'
  public code = 'P5014'
  public logs: string[]

  constructor(info: EngineStartupErrorInfo, message: string, logs: string[]) {
    super(message, setRetryable(info, true))
    this.logs = logs
  }
}
