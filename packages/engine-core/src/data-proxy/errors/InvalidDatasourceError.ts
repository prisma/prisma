import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import { setRetryable } from './utils/setRetryable'

export interface InvalidDatasourceErrorInfo extends DataProxyErrorInfo {}
export class InvalidDatasourceError extends DataProxyError {
  public name = 'InvalidDatasourceError'
  public code = 'P5002'

  constructor(message: string, info: InvalidDatasourceErrorInfo) {
    super(message, setRetryable(info, false))
  }
}
