import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class NotFoundError extends DataProxyAPIError {
  public code = 'P5003'

  constructor(response: RequestResponse) {
    super('Requested resource does not exist.', {
      isRetriable: false,
      response,
    })
  }
}
