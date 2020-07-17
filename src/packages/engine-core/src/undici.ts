import getStream from 'get-stream'
import { Pool } from 'undici'

export class Undici {
  private pool: any
  private closed = false
  constructor(url: string) {
    this.pool = new Pool(url, {
      connections: 100,
      pipelining: 10,
    })
  }
  request(body: any, customHeaders?: Record<string, string>) {
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
