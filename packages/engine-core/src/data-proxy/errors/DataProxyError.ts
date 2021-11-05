import { PrismaClientError } from '../../common/errors/PrismaClientError'

export interface DataProxyErrorInfo {
  isRetriable: boolean
}

export abstract class DataProxyError extends PrismaClientError {
  isRetriable: boolean

  constructor(message: string, info: DataProxyErrorInfo) {
    super(message)

    this.isRetriable = info.isRetriable
  }
}
