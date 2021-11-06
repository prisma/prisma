import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'
import type { RequestResponse } from '../utils/request'

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
