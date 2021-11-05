import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class UnauthorizedError extends DataProxyAPIError {
  public code = 'P5007'

  constructor(response: RequestResponse) {
    super('Could not authorize this request. Check your Data Proxy connection string.', {
      isRetriable: false,
      response,
    })
  }
}
