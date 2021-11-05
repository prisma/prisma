export abstract class DataProxyError extends Error {
  constructor(message: string, public isRetriable: boolean) {
    super(message)
  }
}
