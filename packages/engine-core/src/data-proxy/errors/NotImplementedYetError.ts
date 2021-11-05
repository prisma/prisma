import { DataProxyError } from './DataProxyError'

export class NotImplementedYetError extends DataProxyError {
  constructor(message: string) {
    super(message, false)
  }
}
