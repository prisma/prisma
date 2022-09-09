import Debug from '@prisma/debug'
import fs from 'fs'
import hasha from 'hasha'
import fetch from 'node-fetch'
import retry from 'p-retry'
import path from 'path'
import rimraf from 'rimraf'
import tempy from 'tempy'
import { promisify } from 'util'
import zlib from 'zlib'

import { getProxyAgent } from './getProxyAgent'
import { overwriteFile } from './utils'

const debug = Debug('prisma:downloadZip')
const del = promisify(rimraf)

export type DownloadResult = {
  lastModified: string
  sha256: string
  zippedSha256: string
}

async function fetchSha256(url: string): Promise<{ sha256: string; zippedSha256: string }> {
  // We get a string like this:
  // "3c82ee6cd9fedaec18a5e7cd3fc41f8c6b3dd32575dc13443d96aab4bd018411  query-engine.gz\n"
  // So we split it by whitespace and just get the hash, as that's what we're interested in
  const [zippedSha256, sha256] = [
    (
      await fetch(`${url}.sha256`, {
        agent: getProxyAgent(url) as any,
      }).then((res) => res.text())
    ).split(/\s+/)[0],
    (
      await fetch(`${url.slice(0, url.length - 3)}.sha256`, {
        agent: getProxyAgent(url.slice(0, url.length - 3)) as any,
      }).then((res) => res.text())
    ).split(/\s+/)[0],
  ]

  return { sha256, zippedSha256 }
}

export async function downloadZip(
  url: string,
  target: string,
  progressCb?: (progress: number) => void,
): Promise<DownloadResult> {
  const tmpDir = tempy.directory()
  const partial = path.join(tmpDir, 'partial')
  const { sha256, zippedSha256 } = await fetchSha256(url)
  const result = await retry(
    async () => {
      try {
        const resp = await fetch(url, {
          compress: false,
          agent: getProxyAgent(url) as any,
        })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        const lastModified = resp.headers.get('last-modified')!
        const size = parseFloat(resp.headers.get('content-length') as string)
        const ws = fs.createWriteStream(partial)

        // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
        return await new Promise(async (resolve, reject) => {
          let bytesRead = 0

          resp.body.on('error', reject).on('data', (chunk) => {
            bytesRead += chunk.length

            if (size && progressCb) {
              progressCb(bytesRead / size)
            }
          })

          const gunzip = zlib.createGunzip()

          gunzip.on('error', reject)

          const zipStream = resp.body.pipe(gunzip)
          const zippedHashPromise = hasha.fromStream(resp.body, {
            algorithm: 'sha256',
          })
          const hashPromise = hasha.fromStream(zipStream, {
            algorithm: 'sha256',
          })
          zipStream.pipe(ws)

          ws.on('error', reject).on('close', () => {
            resolve({ lastModified, sha256, zippedSha256 })
          })

          const hash = await hashPromise
          const zippedHash = await zippedHashPromise

          if (zippedHash !== zippedSha256) {
            throw new Error(`sha256 of ${url} (zipped) should be ${zippedSha256} but is ${zippedHash}`)
          }

          if (hash !== sha256) {
            throw new Error(`sha256 of ${url} (uzipped) should be ${sha256} but is ${hash}`)
          }
        })
      } finally {
        //
      }
    },
    {
      retries: 2,
      onFailedAttempt: (err) => debug(err),
    },
  )

  await overwriteFile(partial, target)

  // it's ok if the unlink fails
  try {
    await del(partial)
    await del(tmpDir)
  } catch (e) {
    debug(e)
  }

  return result as DownloadResult
}
