import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class ServerError extends DataProxyAPIError {
  public code = 'P5006'

  constructor(response: RequestResponse) {
    super('Unknown server error. This request can be retried later.', {
      isRetriable: true,
      response,
    })
  }
}
