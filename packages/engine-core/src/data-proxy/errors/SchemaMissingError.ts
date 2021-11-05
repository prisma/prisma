import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from './request'

export class SchemaMissingError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Could not find the schema. This request can be retried after schema upload.', true)
  }
}
