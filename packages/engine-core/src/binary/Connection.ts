import getStream from 'get-stream'
import type { Client } from 'undici'
import { Pool } from 'undici'
import type { URL } from 'url'

export type Result<R> = {
  statusCode: Client.ResponseData['statusCode']
  headers: Client.ResponseData['headers']
  data: R
}

/**
 * Assertion function to make sure that we have a pool
 * @param pool
 */
function assertHasPool<A>(pool: A): asserts pool is NonNullable<A> {
  if (pool === undefined) {
    throw new Error('Connection has not been opened')
  }
}

/**
 * Open an HTTP connection pool
 */
export class Connection {
  private _pool: Pool | undefined

  constructor() {}

  /**
   * Wrapper to handle HTTP error codes. HTTP errors don't trigger any
   * execptions because it is optional to handle error status codes.
   * @param response to handle
   * @param handler to execute
   * @returns
   */
  static async onHttpError<R, HR>(
    response: Promise<Result<R>>,
    handler: (result: Result<R>) => HR,
  ) {
    const _response = await response

    if (_response.statusCode >= 400) {
      return handler(_response)
    }

    return _response
  }

  /**
   * Initiates a new connection pool
   * @param url
   * @param options
   * @returns
   */
  open(url: string | URL, options?: Pool.Options) {
    if (this._pool) return

    this._pool = new Pool(url, {
      connections: 100,
      pipelining: 10,
      keepAliveMaxTimeout: 600e3,
      headersTimeout: 0,
      ...options,
    })
  }

  /**
   * Perform a request
   * @param method
   * @param endpoint
   * @param headers
   * @param body
   * @returns
   */
  async raw<R>(
    method: 'POST' | 'GET',
    endpoint: string,
    headers?: Client.DispatchOptions['headers'],
    body?: Client.DispatchOptions['body'],
  ) {
    assertHasPool(this._pool)

    const response = await this._pool.request({
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
      bodyTimeout: 0,
    })

    const result: Result<R> = {
      statusCode: response.statusCode,
      headers: response.headers,
      data: JSON.parse(await getStream(response.body)) as R,
    }

    return result
  }

  /**
   * Perform a POST request
   * @param endpoint
   * @param body
   * @param headers
   * @returns
   */
  post<R>(
    endpoint: string,
    body?: Client.DispatchOptions['body'],
    headers?: Client.DispatchOptions['headers'],
  ) {
    return this.raw<R>('POST', endpoint, headers, body)
  }

  /**
   * Perform a GET request
   * @param endpoint
   * @param body
   * @param headers
   * @returns
   */
  get<R>(path: string, headers?: Client.DispatchOptions['headers']) {
    return this.raw<R>('GET', path, headers)
  }

  /**
   * Close the connections
   */
  close() {
    if (this._pool) {
      this._pool.close(() => {
        // ignore close errors
      })
    }

    this._pool = undefined
  }
}
