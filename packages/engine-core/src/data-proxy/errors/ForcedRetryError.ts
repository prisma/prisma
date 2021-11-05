import { DataProxyError } from './DataProxyError'

export class ForcedRetryError extends DataProxyError {
  constructor(public originalError: DataProxyError) {
    super('This request must be retried.', true)
  }
}
