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
        res.setEncoding('utf-8')
        const chunks = []
        res.on('data', (chunk) => {
          chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({ data: JSON.parse(chunks.join('')), headers: res.headers })
        })
      },
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// async function main() {
//   for (let i = 0; i < 100; i++) {
//     const result = await h1Post(5000, { h: 'lo' })
//     console.log({ result })
//   }
// }

// main()
