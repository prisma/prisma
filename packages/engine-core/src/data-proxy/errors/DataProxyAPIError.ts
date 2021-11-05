import { DataProxyError } from './DataProxyError'
import type { RequestResponse } from '../utils/request'

export class DataProxyAPIError extends DataProxyError {
  constructor(public res: RequestResponse, message: string, isRetriable: boolean) {
    super(message, isRetriable)
  }
}
