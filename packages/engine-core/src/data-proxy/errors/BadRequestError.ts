import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class BadRequestError extends DataProxyAPIError {
  public code = 'P5000'

  constructor(response: RequestResponse) {
    super('This request could not be understood by the server.', {
      isRetriable: false,
      response,
    })
  }
}
