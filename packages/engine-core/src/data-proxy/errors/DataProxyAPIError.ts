import type { RequestResponse } from '../utils/request'
import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'

export interface DataProxyAPIErrorInfo extends DataProxyErrorInfo {
  response: RequestResponse
}

export abstract class DataProxyAPIError extends DataProxyError {
  response: RequestResponse

  constructor(message: string, info: DataProxyAPIErrorInfo) {
    super(message, info)

    this.response = info.response
  }
}
