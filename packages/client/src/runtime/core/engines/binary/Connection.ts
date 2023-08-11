import getStream from 'get-stream'
import type { Dispatcher, Pool } from 'undici'
import type { URL } from 'url'

export type Result<R> = {
  statusCode: Dispatcher.ResponseData['statusCode']
  headers: Dispatcher.ResponseData['headers']
  data: R
}

// because undici lazily loads llhttp wasm which bloats the memory
// TODO: hopefully replace with `import` but that causes segfaults
const undici = () => require('undici')

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
   * exceptions because it is optional to handle error status codes.
   * @param response to handle
   * @param handler to execute
   * @returns
   */
  static async onHttpError<R, HR>(response: Promise<Result<R>>, handler: (result: Result<R>) => HR) {
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

    this._pool = new (undici().Pool)(url, {
      connections: 1000,
      keepAliveMaxTimeout: 600e3,
      headersTimeout: 0,
      bodyTimeout: 0,
      ...options,
    })
  }

  /**
   * Perform a request
   * @param method
   * @param endpoint
   * @param headers
   * @param body
   * @param parseResponse
   * @returns
   */
  async raw<R>(
    method: 'POST' | 'GET',
    endpoint: string,
    headers?: Dispatcher.DispatchOptions['headers'],
    body?: Dispatcher.DispatchOptions['body'],
    parseResponse = true,
  ): Promise<Result<R>> {
    assertHasPool(this._pool)

    const response = await this._pool.request({
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body,
    })

    const bodyString = await getStream(response.body)

    return {
      statusCode: response.statusCode,
      headers: response.headers,
      data: parseResponse ? JSON.parse(bodyString) : bodyString,
    }
  }

  /**
   * Perform a POST request
   * @param endpoint
   * @param body
   * @param headers
   * @param parseResponse
   * @returns
   */
  post<R>(
    endpoint: string,
    body?: Dispatcher.DispatchOptions['body'],
    headers?: Dispatcher.DispatchOptions['headers'],
    parseResponse?: boolean,
  ) {
    return this.raw<R>('POST', endpoint, headers, body, parseResponse)
  }

  /**
   * Perform a GET request
   * @param endpoint
   * @param body
   * @param headers
   * @returns
   */
  get<R>(path: string, headers?: Dispatcher.DispatchOptions['headers']) {
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
