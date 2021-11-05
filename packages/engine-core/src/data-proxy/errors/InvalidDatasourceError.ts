import { DataProxyError } from './DataProxyError'

export class InvalidDatasourceError extends DataProxyError {
  public code = 'P5002'

  constructor(message: string) {
    super(message, { isRetriable: false })
  }
}
