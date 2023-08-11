import { PrismaClientError, type PrismaClientErrorInfo } from '../../../errors/PrismaClientError'

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
