const getStream = require('get-stream')
const undici = require('undici')

export class Undici {
  client: any
  constructor(url) {
    this.client = undici(url, {
      connections: 100,
      pipelining: 10,
    })
  }
  request(body) {
    return new Promise((resolve, reject) => {
      this.client.request(
        {
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
}
