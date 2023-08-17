import { setClassName } from '@prisma/internals'

import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface EngineVersionNotSupportedErrorInfo extends DataProxyAPIErrorInfo {}

export class EngineVersionNotSupportedError extends DataProxyAPIError {
  public name = 'EngineVersionNotSupportedError'
  public code = 'P5012'

  constructor(info: EngineVersionNotSupportedErrorInfo) {
    super('Engine version is not supported', setRetryable(info, false))
  }
}
setClassName(EngineVersionNotSupportedError, 'EngineVersionNotSupportedError')
