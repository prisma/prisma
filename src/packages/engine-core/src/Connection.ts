import getStream = require('get-stream')
import { Client, Pool } from 'undici'
import { URL } from 'url'

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

    const res = await this._pool.request({
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
      bodyTimeout: 0,
    })

    return {
      statusCode: res.statusCode,
      headers: res.headers,
      data: JSON.parse(await getStream(res.body)) as R,
    }
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
