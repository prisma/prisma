import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface SchemaMissingErrorInfo extends DataProxyAPIErrorInfo {}

export class SchemaMissingError extends DataProxyAPIError {
  public code = 'P5005'

  constructor(info: DataProxyAPIErrorInfo) {
    super('Could not find the schema', setRetryable(info, true))
  }
}
