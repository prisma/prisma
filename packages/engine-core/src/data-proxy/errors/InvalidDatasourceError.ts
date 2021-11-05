import { DataProxyError } from './DataProxyError'

export class InvalidDatasourceError extends DataProxyError {
  constructor(message: string) {
    super(message, false)
  }
}
