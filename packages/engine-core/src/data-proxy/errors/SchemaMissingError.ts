import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class SchemaMissingError extends DataProxyAPIError {
  public code = 'P5005'

  constructor(response: RequestResponse) {
    super('Could not find the schema. This request can be retried after schema upload.', {
      isRetriable: true,
      response,
    })
  }
}
