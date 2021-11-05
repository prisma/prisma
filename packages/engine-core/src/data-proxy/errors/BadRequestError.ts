import { DataProxyAPIError } from './DataProxyAPIError'
import type { RequestResponse } from '../utils/request'

export class BadRequestError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'This request could not be understood by the server.', false)
  }
}
