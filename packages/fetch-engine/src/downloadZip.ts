import zlib from 'zlib'
import retry from 'p-retry'
import fetch from 'node-fetch'
import fs from 'fs'
import { getProxyAgent } from './getProxyAgent'
import tempy from 'tempy'
import path from 'path'
import Debug from 'debug'
const debug = Debug('downloadZip')

export async function downloadZip(
  url: string,
  target: string,
  progressCb?: (progress: number) => any,
): Promise<string> {
  const tmpDir = tempy.directory()
  const partial = path.join(tmpDir, 'partial')
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
    } as any,
  )
  fs.renameSync(partial, target)

  // it's ok if the unlink fails
  try {
    fs.unlinkSync(tmpDir)
  } catch (e) {
    debug(e)
  }

  return result as string
}
