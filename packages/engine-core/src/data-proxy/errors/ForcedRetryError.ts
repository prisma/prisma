import { DataProxyError } from './DataProxyError'

export class ForcedRetryError extends DataProxyError {
  public code = 'P5001'

  constructor(public originalError: DataProxyError) {
    super('This request must be retried.', {
      isRetriable: true,
    })
  }
}
