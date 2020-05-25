import http from 'http'

const agent = new http.Agent({ keepAlive: true, maxSockets: 100 })

export function h1Post(port: number, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        agent,
        hostname: 'localhost',
        path: '/',
        method: 'POST',
        port,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => {
          chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({
            data: JSON.parse(Buffer.concat(chunks) as any),
            headers: res.headers,
          })
        })
      },
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}
