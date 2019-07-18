// Inspired by https://github.com/zeit/now-cli/blob/canary/download/src/index.js
// Native
import fs from 'fs'
import zlib from 'zlib'
import os from 'os'
import makeDir from 'make-dir'
import { promisify } from 'util'

// Packages
import onDeath from 'death'
import fetch from 'node-fetch'
import retry from 'p-retry'
import path from 'path'
import Progress from 'progress'
import findCacheDir from 'find-cache-dir'

// Utils
import { getBar, info, warn } from './log'
import plusxSync from './chmod'
import { copy } from './copy'
import { getos } from './getos'
import Debug from 'debug'
const debug = Debug('download')

const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

// TODO: make channel configurable
const channel = 'alpha'

export async function downloadMigrationBinary(
  migrationBinary: string,
  version: string = 'latest',
  showProgress = false,
) {
  try {
    fs.writeFileSync(
      migrationBinary,
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
      migrationBinary,
      '#!/usr/bin/env node\n' +
        'console.log("The \'prisma\' installation did not complete successfully.")\n' +
        'console.log("Please run \'npm i -g prisma\' to reinstall!")\n',
    )
    process.exit()
  })

  // Print an empty line
  const platform = await getPlatform()
  const cacheDir = await getCacheDir(channel, version, platform)
  const cachedMigrationEnginePath = path.join(cacheDir, 'migration-engine')
  const cachedLastModifiedPath = path.join(cacheDir, 'lastModifiedMigrationEngine')

  const [cachedMigrationEngineExists, localLastModified] = await Promise.all([
    exists(cachedMigrationEnginePath),
    getLocalLastModified(cachedLastModifiedPath),
  ])

  if (cachedMigrationEngineExists && localLastModified) {
    const remoteLastModified = await getRemoteLastModified(getMigrationEngineDownloadUrl(channel, version, platform))
    // If there is no new binary and we have it localy, copy it over
    if (localLastModified >= remoteLastModified) {
      // console.log(`Taking migration engine binary from local cache from ${localLastModified.toISOString()}`)
      await Promise.all([copy(cachedMigrationEnginePath, migrationBinary)])
      return
    }
  }

  const bar = showProgress ? getBar('Downloading Prisma Binary ' + version) : null
  if (bar) {
    bar.update(0)
  }

  const lastModified = await downloadZip(
    getMigrationEngineDownloadUrl(channel, version, platform),
    migrationBinary,
    0,
    bar,
  )
  if (bar) {
    bar.update(1)
    bar.terminate()
  }

  plusxSync(migrationBinary)

  /**
   * Cache the result only on Mac for better dev experience
   */
  if (platform === 'darwin') {
    try {
      await copy(migrationBinary, cachedMigrationEnginePath)
      await writeFile(cachedLastModifiedPath, lastModified)
    } catch (e) {
      // console.error(e)
      // let this fail silently - the CI system may have reached the file size limit
    }
  }
}

/**
 * TODO: Check if binary already exists and if checksum is the same!
 */
export async function download(prismaBinPath: string, version: string = 'latest', showProgress = false) {
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

  // Print an empty line
  const platform = await getPlatform()
  const cacheDir = await getCacheDir(channel, version, platform)
  console.log(`Downloading ${channel}/${version}/${platform}`)
  const cachedPrismaPath = path.join(cacheDir, 'prisma')
  const cachedLastModifiedPath = path.join(cacheDir, 'lastModified')

  const [cachedPrismaExists, localLastModified] = await Promise.all([
    exists(cachedPrismaPath),
    getLocalLastModified(cachedLastModifiedPath),
  ])

  if (cachedPrismaExists && localLastModified) {
    const remoteLastModified = await getRemoteLastModified(getPrismaDownloadUrl(channel, version, platform))
    // If there is no new binary and we have it localy, copy it over
    if (localLastModified >= remoteLastModified) {
      // console.log(`Taking binaries from local cache from ${localLastModified.toISOString()}`)
      await copy(cachedPrismaPath, prismaBinPath)
      return
    }
  }

  const bar = showProgress ? getBar('Downloading Prisma Binary ' + version) : null
  if (bar) {
    bar.update(0)
  }

  const lastModified = await downloadZip(getPrismaDownloadUrl(channel, version, platform), prismaBinPath, 0, bar)
  if (bar) {
    bar.update(1)
    bar.terminate()
  }

  plusxSync(prismaBinPath)

  /**
   * Cache the result only on Mac for better dev experience
   */
  if (platform === 'darwin') {
    try {
      await copy(prismaBinPath, cachedPrismaPath)
      await writeFile(cachedLastModifiedPath, lastModified)
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

async function downloadZip(url: string, target: string, progressOffset = 0, bar?: Progress) {
  // console.log('Downloading ', url)
  const partial = target + '.partial'
  const result = await retry(
    async () => {
      try {
        const resp = await fetch(url, { compress: false })

        if (resp.status !== 200) {
          throw new Error(resp.statusText + ' ' + url)
        }

        const lastModified = resp.headers.get('last-modified')!
        const size = resp.headers.get('content-length')
        const ws = fs.createWriteStream(partial)

        return await new Promise((resolve, reject) => {
          let bytesRead = 0

          resp.body.on('error', reject).on('data', chunk => {
            bytesRead += chunk.length

            if (size && bar) {
              bar.update(((50 * bytesRead) / parseFloat(size) + progressOffset) / 100)
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

async function downloadFile(
  url: string,
  target: string,
  progressOffset = 0,
  maxProgress = 100,
  bar?: Progress,
): Promise<string> {
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

          if (size && bar) {
            bar.update(((maxProgress * bytesRead) / parseFloat(size) + progressOffset) / 100)
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

async function getRootCacheDir(platform: string): Promise<string> {
  if (platform === 'darwin' || platform.startsWith('linux')) {
    return path.join(os.homedir(), '.cache/prisma')
  }
  return findCacheDir({ name: 'prisma' })
}

async function getCacheDir(channel: string, version: string, platform: string): Promise<string> {
  const rootCacheDir = await getRootCacheDir(platform)
  const cacheDir = path.join(rootCacheDir, channel, version, platform)
  await makeDir(cacheDir)
  return cacheDir
}

async function getPlatform() {
  const { platform, libssl } = await getos()

  if (platform === 'darwin') {
    return 'darwin'
  }

  debug({ platform, libssl })

  if (platform === 'linux' && libssl) {
    if (libssl === '1.0.2') {
      return 'linux-glibc-libssl1.0.2'
    }

    if (libssl === '1.0.1') {
      return 'linux-glibc-libssl1.0.1'
    }
  }

  return 'linux-glibc-libssl1.1.0'
}

function getPrismaDownloadUrl(channel: string, version: string, platform: string) {
  return `https://s3-eu-west-1.amazonaws.com/prisma-native/${channel}/${version}/${platform}/prisma.gz`
}

function getMigrationEngineDownloadUrl(channel: string, version: string, platform: string) {
  return `https://s3-eu-west-1.amazonaws.com/prisma-native/${channel}/${version}/${platform}/migration-engine.gz`
}
