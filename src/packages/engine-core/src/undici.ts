import getStream = require('get-stream')
import { Client, Pool } from 'undici'
import { URL } from 'url'
export class Undici {
  private pool: Pool
  private closed = false
  constructor(url: string | URL, moreArgs?: Pool.Options) {
    this.pool = new Pool(url, {
      connections: 100,
      pipelining: 10,
      keepAliveMaxTimeout: 600e3,
      headersTimeout: 0,
      ...moreArgs,
    })
  }
  request(
    body: Client.DispatchOptions['body'],
    customHeaders?: Record<string, string>,
  ) {
    return new Promise((resolve, reject) => {
      this.pool.request(
        {
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...customHeaders,
          },
          body,
          bodyTimeout: 0,
        },
        async (err, result) => {
          if (err) {
            reject(err)
          } else {
            const { statusCode, headers, body } = result
            const data = JSON.parse(await getStream(body))
            resolve({ statusCode, headers, data })
          }
        },
      )
    })
  }
  status() {
    return new Promise((resolve, reject) => {
      this.pool.request(
        {
          path: '/',
          method: 'GET',
        },
        async (err, result) => {
          if (err) {
            reject(err)
          } else {
            const { statusCode, headers, body } = result
            const data = JSON.parse(await getStream(body))
            resolve({ statusCode, headers, data })
          }
        },
      )
    })
  }
  close() {
    if (!this.closed) {
      this.pool.close(() => {
        // ignore close error
      })
    }
    this.closed = true
  }
}
