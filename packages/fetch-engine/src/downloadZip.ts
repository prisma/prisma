import zlib from 'zlib'
import retry from 'p-retry'
import fetch from 'node-fetch'
import fs from 'fs'
import { getProxyAgent } from './getProxyAgent'

export async function downloadZip(url: string, target: string, progressCb?: (progress: number) => any) {
  const partial = target + '.partial'
  const result = await retry(
    async () => {
      try {
        const resp = await fetch(url, { compress: false, agent: getProxyAgent(url) })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        const lastModified = resp.headers.get('last-modified')!
        const size = parseFloat(resp.headers.get('content-length'))
        const ws = fs.createWriteStream(partial)

        return await new Promise((resolve, reject) => {
          let bytesRead = 0

          resp.body.on('error', reject).on('data', chunk => {
            bytesRead += chunk.length

            if (size && progressCb) {
              progressCb(bytesRead / size)
            }
          })

          const gunzip = zlib.createGunzip()

          gunzip.on('error', reject)

          resp.body.pipe(gunzip).pipe(ws)

          ws.on('error', reject).on('close', () => {
            resolve(lastModified)
          })
        })
      } finally {
        //
      }
    },
    {
      retries: 1,
      onFailedAttempt: err => console.error(err),
    },
  )
  fs.renameSync(partial, target)
  return result
}
