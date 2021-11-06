import type { PrismaClientErrorInfo } from '../../common/errors/PrismaClientError'
import { PrismaClientError } from '../../common/errors/PrismaClientError'

export interface DataProxyErrorInfo extends PrismaClientErrorInfo {
  isRetryable?: boolean
}

export abstract class DataProxyError extends PrismaClientError {
  isRetryable: boolean

  constructor(message: string, info: DataProxyErrorInfo) {
    super(message, info)

    this.isRetryable = info.isRetryable ?? true
  }
}
