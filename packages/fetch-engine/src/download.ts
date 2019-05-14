// Inspired by https://github.com/zeit/now-cli/blob/canary/download/src/index.js
// Native
import fs from 'fs'
import zlib from 'zlib'
import os from 'os'
import makeDir from 'make-dir'

// Packages
import onDeath from 'death'
import fetch from 'node-fetch'
import retry from 'p-retry'
import getos from 'getos'
import path from 'path'

// Utils
import { disableProgress, enableProgress, info, showProgress, warn } from './log'
import plusxSync from './chmod'
import findCacheDir from 'find-cache-dir'
import { copy } from './copy'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

/**
 * TODO: Check if binary already exists and if checksum is the same!
 */
export async function download(prismaBinPath: string, schemaInferrerBinPath: string, version: string) {
  try {
    fs.writeFileSync(
      prismaBinPath,
      '#!/usr/bin/env node\n' + 'console.log("Please wait until the \'prisma\' installation completes!")\n',
    )
  } catch (err) {
    if (err.code === 'EACCES') {
      warn('Please try installing Prisma CLI again with the `--unsafe-perm` option.')
      info('Example: `npm i -g --unsafe-perm prisma`')

      process.exit()
    }

    throw err
  }

  onDeath(() => {
    fs.writeFileSync(
      prismaBinPath,
      '#!/usr/bin/env node\n' +
        'console.log("The \'prisma\' installation did not complete successfully.")\n' +
        'console.log("Please run \'npm i -g prisma\' to reinstall!")\n',
    )
    process.exit()
  })

  info('For the source code, check out: https://github.com/prisma/prisma')

  // Print an empty line
  const platform = await getPlatform()
  const cacheDir = await getCacheDir(platform)
  const cachedPrismaPath = path.join(cacheDir, 'prisma')
  const cachedSchemaInferrerPath = path.join(cacheDir, 'schema-inferrer-bin')
  const cachedLastModifiedPath = path.join(cacheDir, 'lastModified')

  const [cachedPrismaExists, cachedSchemaInferrerExists, localLastModified] = await Promise.all([
    exists(cachedPrismaPath),
    exists(cachedSchemaInferrerPath),
    getLocalLastModified(cachedLastModifiedPath),
  ])

  if (cachedPrismaExists && cachedSchemaInferrerExists && localLastModified) {
    const remoteLastModified = await getRemoteLastModified(getPrismaDownloadUrl(platform))
    // If there is no new binary and we have it localy, copy it over
    if (localLastModified >= remoteLastModified) {
      console.log(`Taking binaries from local cache from ${localLastModified.toISOString()}`)
      await Promise.all([copy(cachedPrismaPath, prismaBinPath), copy(cachedSchemaInferrerPath, schemaInferrerBinPath)])
      return
    }
  }

  enableProgress('Downloading Prisma Binary ' + version)
  showProgress(0)

  const lastModified = await downloadFile(getPrismaDownloadUrl(platform), prismaBinPath)
  await downloadZip(getSchemaInferrerDownloadUrl(platform), schemaInferrerBinPath, 50)
  showProgress(100)
  disableProgress()

  plusxSync(prismaBinPath)
  plusxSync(schemaInferrerBinPath)

  /**
   * Cache the result only on Mac for better dev experience
   */
  if (platform === 'darwin') {
    try {
      await copy(prismaBinPath, cachedPrismaPath)
      await copy(schemaInferrerBinPath, cachedSchemaInferrerPath)
      writeFile(cachedLastModifiedPath, lastModified)
    } catch (e) {
      // console.error(e)
      // let this fail silently - the CI system may have reached the file size limit
    }
  }
}

async function getLocalLastModified(filePath: string): Promise<Date | null> {
  const fileExists = await exists(filePath)
  if (!fileExists) {
    return null
  }
  const file = await readFile(filePath, 'utf-8')
  if (!file || file.length === 0) {
    return null
  }
  return new Date(file)
}

async function getRemoteLastModified(url: string): Promise<Date> {
  const response = await fetch(url, {
    method: 'HEAD',
  })
  return new Date(response.headers.get('last-modified'))
}

async function downloadZip(url: string, target: string, progressOffset = 0) {
  const partial = target + '.partial'
  await retry(
    async () => {
      try {
        const resp = await fetch(url, { compress: false })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        const size = resp.headers.get('content-length')
        const ws = fs.createWriteStream(partial)

        await new Promise((resolve, reject) => {
          let bytesRead = 0

          resp.body.on('error', reject).on('data', chunk => {
            bytesRead += chunk.length

            if (size) {
              showProgress((50 * bytesRead) / parseFloat(size) + progressOffset)
            }
          })

          const gunzip = zlib.createGunzip()

          gunzip.on('error', reject)

          resp.body.pipe(gunzip).pipe(ws)

          ws.on('error', reject).on('close', () => {
            resolve()
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
}

async function downloadFile(url: string, target: string, progressOffset = 0): Promise<string> {
  return retry<string>(
    async () => {
      const resp = await fetch(url, { compress: false })

      const lastModified = resp.headers.get('last-modified')!

      if (resp.status !== 200) {
        throw new Error(resp.statusText + ' ' + url)
      }

      const size = resp.headers.get('content-length')
      const ws = fs.createWriteStream(target)

      return new Promise<string>((resolve, reject) => {
        let bytesRead = 0

        resp.body.on('error', reject).on('data', chunk => {
          bytesRead += chunk.length

          if (size) {
            showProgress((50 * bytesRead) / parseFloat(size) + progressOffset)
          }
        })

        resp.body.pipe(ws)

        ws.on('error', reject).on('close', () => {
          resolve(lastModified)
        })
      })
    },
    {
      retries: 2,
      onFailedAttempt: err => console.error(err),
    },
  )
}

async function getCacheDir(platform: string): Promise<string> {
  if (platform === 'darwin' || platform.startsWith('linux')) {
    const cacheDir = path.join(os.homedir(), '.cache/prisma')
    await makeDir(cacheDir)
    return cacheDir
  }
  return findCacheDir({ name: 'prisma' })
}

async function getPlatform() {
  const { os, dist } = (await new Promise(r => {
    getos((e, os) => {
      r(os)
    })
  })) as any

  if (os === 'darwin') {
    return 'darwin'
  }

  if (os === 'linux' && dist === 'Raspbian') {
    return 'linux-musl'
  }

  return 'linux-glibc'
}

function getSchemaInferrerDownloadUrl(platform: string) {
  if (platform.startsWith('linux-')) {
    platform = 'linux'
  }
  return `https://s3-eu-west-1.amazonaws.com/curl-linux/prisma-native/${platform}/schema-inferrer-bin.gz`
}

function getPrismaDownloadUrl(platform: string) {
  return `https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/${platform}/prisma`
}
