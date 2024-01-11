import { setClassName } from '@prisma/internals'

import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import { setRetryable } from './utils/setRetryable'

export interface InvalidDatasourceErrorInfo extends DataProxyErrorInfo {}
export class InvalidDatasourceError extends DataProxyError {
  public name = 'InvalidDatasourceError'
  public code = 'P6001'

  constructor(message: string, info: InvalidDatasourceErrorInfo) {
    super(message, setRetryable(info, false))
  }
}
setClassName(InvalidDatasourceError, 'InvalidDatasourceError')
