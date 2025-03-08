import type { DataProxyErrorInfo } from './DataProxyError'
import { DataProxyError } from './DataProxyError'

export interface DataProxyAPIErrorInfo extends DataProxyErrorInfo {
  response: Response
}

export abstract class DataProxyAPIError extends DataProxyError {
  response: Response

  constructor(message: string, info: DataProxyAPIErrorInfo) {
    super(message, info)

    this.response = info.response

    // add request id to response message if it is present in the response header
    const requestId = this.response.headers.get('prisma-request-id')
    if (requestId) {
      const messageSuffix = `(The request id was: ${requestId})`
      this.message = `${this.message} ${messageSuffix}`
    }
  }
}
