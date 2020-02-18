import http2 from 'http2'
import { PrismaQueryEngineError } from './Engine'

export class Client {
  private session: http2.ClientHttp2Session
  constructor(url: string) {
    this.session = http2.connect(url, {})

    // necessary to disable Node.js' error handling and us handle the error in .on('error') of the session
    this.session.on('error', e => {})
  }
  close() {
    this.session.destroy()
  }
  request(body: any) {
    return new Promise((resolve, reject) => {
      try {
        let rejected = false

        const buffer = Buffer.from(JSON.stringify(body))

        const req = this.session.request({
          [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_POST,
          [http2.constants.HTTP2_HEADER_PATH]: `/`,
          'Content-Type': 'application/json',
          'Content-Length': buffer.length,
        })

        req.setEncoding('utf8')
        let data = []
        let headers

        req.on('error', e => {
          rejected = true
          if (e.code && e.code === 'ECONNREFUSED') {
            reject(new Error(`Prisma Client could not connect to query engine.`))
          } else {
            reject(e)
          }
        })

        req.on('data', chunk => {
          data.push(chunk)
        })

        req.on('response', res => {
          headers = res
          if (res[':status'] === 408) {
            rejected = true
            return reject(
              new PrismaQueryEngineError(
                `Timeout in query engine. This is probably related to the database being overwhelmed.`,
                res[':status'],
              ),
            )
          }
          if (res[':status'] > 226) {
            rejected = true
            reject(
              new PrismaQueryEngineError(
                `Error in query engine response, status code ${res[':status']}${data ? ': ' + data : ''}`,
                res[':status'],
              ),
            )
          }
        })

        if (!rejected) {
          req.write(buffer)
          req.end()
        }

        req.on('end', () => {
          if (data && data.length > 0 && !rejected) {
            resolve({ body: JSON.parse(data.join('')), headers })
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  }
}
