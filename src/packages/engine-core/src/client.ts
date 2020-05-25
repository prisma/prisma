import http2 from 'http2'
import { PrismaQueryEngineError } from './Engine'

let buffer: Buffer | undefined

export class H2Client {
  private session: http2.ClientHttp2Session
  constructor(url: string) {
    this.session = http2.connect(url, {
      maxSessionMemory: 20,
    })

    // necessary to disable Node.js' error handling and us handle the error in .on('error') of the session
    this.session.on('error', () => {}) // eslint-disable-line @typescript-eslint/no-empty-function
  }
  close(): void {
    this.session.destroy()
  }
  request(body: string): Promise<{ data: any; headers: any }> {
    return new Promise((resolve, reject) => {
      try {
        let rejected = false

        const buffer = Buffer.from(body)

        const req = this.session.request({
          [http2.constants.HTTP2_HEADER_METHOD]:
            http2.constants.HTTP2_METHOD_POST,
          'Content-Type': 'application/json',
          'Content-Length': buffer.length,
          'Accept-Encoding': 'gzip, deflare, br',
        })

        const data = []
        let headers

        req.on('error', (e) => {
          rejected = true
          if (e.code && e.code === 'ECONNREFUSED') {
            reject(
              new Error(`Prisma Client could not connect to query engine.`),
            )
          } else {
            reject(e)
          }
        })

        req.on('data', (chunk) => {
          data.push(chunk)
        })

        req.on('response', (res) => {
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
                `Error in query engine response, status code ${res[':status']}${
                  data ? ': ' + data : ''
                }`,
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
            // for whatever reason, JSON.parse does have incorrect types
            resolve({ data: JSON.parse(Buffer.concat(data) as any), headers })
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  }
}
