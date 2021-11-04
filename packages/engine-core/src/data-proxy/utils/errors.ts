import type { RequestResponse } from './request'

export abstract class DataProxyError extends Error {
  constructor(message: string, public isRetriable: boolean) {
    super(message)
  }
}

export class DataProxyAPIError extends DataProxyError {
  constructor(public res: RequestResponse, message: string, isRetriable: boolean) {
    super(message, isRetriable)
  }
}

export class SchemaMissingError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Could not find the schema. This request can be retried after schema upload.', true)
  }
}

export class NotFoundError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Requested resource does not exist.', false)
  }
}

export class ServerError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Unknown server error. This request can be retried later.', true)
  }
}

export class UsageExceededError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Usage exceeded. This request can be retried later.', true)
  }
}

export class UnauthorizedError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'Could not authorize this request. Check your Data Proxy connection string.', false)
  }
}

export class BadRequestError extends DataProxyAPIError {
  constructor(res: RequestResponse) {
    super(res, 'This request could not be understood by the server.', false)
  }
}

export class ForcedRetryError extends DataProxyError {
  constructor(public originalError: DataProxyError) {
    super('This request must be retried.', true)
  }
}

export class NotImplementedYetError extends DataProxyError {
  constructor(message: string) {
    super(message, false)
  }
}

export class InvalidDatasourceError extends DataProxyError {
  constructor(message: string) {
    super(message, false)
  }
}

export async function responseToError(res: RequestResponse): Promise<DataProxyError | null> {
  if (res.ok) {
    return null
  }

  if (res.status === 401) {
    throw new UnauthorizedError(res)
  }

  if (res.status === 404) {
    try {
      const text = await (res.text ? res.text() : Promise.resolve(''))
      const body = JSON.parse(text)
      const isSchemaMissing = body?.EngineNotStarted?.reason === 'SchemaMissing'

      return isSchemaMissing ? new SchemaMissingError(res) : new NotFoundError(res)
    } catch (err) {
      return new NotFoundError(res)
    }
  }

  if (res.status === 429) {
    throw new UsageExceededError(res)
  }

  if (res.status >= 500) {
    throw new ServerError(res)
  }

  if (res.status >= 400) {
    throw new BadRequestError(res)
  }

  return null
}
