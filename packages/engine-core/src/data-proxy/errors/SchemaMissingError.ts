import type { DataProxyAPIErrorInfo } from './DataProxyAPIError'
import { DataProxyAPIError } from './DataProxyAPIError'
import { setRetryable } from './utils/setRetryable'

export interface SchemaMissingErrorInfo extends DataProxyAPIErrorInfo {}

export class SchemaMissingError extends DataProxyAPIError {
  public name = 'SchemaMissingError'
  public code = 'P5005'

  constructor(info: DataProxyAPIErrorInfo) {
    super('Schema needs to be uploaded', setRetryable(info, true))
  }
}
