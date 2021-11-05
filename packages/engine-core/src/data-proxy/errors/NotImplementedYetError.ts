import { DataProxyError } from './DataProxyError'

export class NotImplementedYetError extends DataProxyError {
  public code = 'P5004'

  constructor(message: string) {
    super(message, { isRetriable: false })
  }
}
