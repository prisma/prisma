import Debug from '@prisma/debug'
import { getNodeAPIName, Platform } from '@prisma/get-platform'
import findCacheDir from 'find-cache-dir'
import fs from 'fs'
import { ensureDir } from 'fs-extra'
import fetch from 'node-fetch'
import os from 'os'
import path from 'path'

import { BinaryType } from './download'
import { getProxyAgent } from './getProxyAgent'

const debug = Debug('prisma:cache-dir')

export async function getRootCacheDir(): Promise<string | null> {
  if (os.platform() === 'win32') {
    const cacheDir = findCacheDir({ name: 'prisma', create: true })
    if (cacheDir) {
      return cacheDir
    }
    if (process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'Prisma')
    }
  }
  // if this is lambda, nope
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    try {
      await ensureDir(`/tmp/prisma-download`)
      return `/tmp/prisma-download`
    } catch (e) {
      return null
    }
  }
  return path.join(os.homedir(), '.cache/prisma')
}

export async function getCacheDir(channel: string, version: string, platform: string): Promise<string | null> {
  const rootCacheDir = await getRootCacheDir()
  if (!rootCacheDir) {
    return null
  }
  const cacheDir = path.join(rootCacheDir, channel, version, platform)
  try {
    if (!fs.existsSync(cacheDir)) {
      await ensureDir(cacheDir)
    }
  } catch (e) {
    debug('The following error is being caught and just there for debugging:')
    debug(e)
    return null
  }
  return cacheDir
}

export enum OfficialMirror {
  R2 = 'https://pub-4cbd40824ac94efbb1399ffcbf438562.r2.dev',
  AWS = 'https://binaries.prisma.sh',
}

export async function getDownloadUrl(
  channel: string,
  version: string,
  platform: Platform,
  binaryName: string,
  extension = '.gz',
) {
  const customMirror =
    process.env.PRISMA_BINARIES_MIRROR || // TODO: remove this
    process.env.PRISMA_ENGINES_MIRROR

  const finalExtension =
    platform === 'windows' && BinaryType.QueryEngineLibrary !== binaryName ? `.exe${extension}` : extension
  if (binaryName === BinaryType.QueryEngineLibrary) {
    binaryName = getNodeAPIName(platform, 'url')
  }

  const engineUrlPath = `${channel}/${version}/${platform}/${binaryName}${finalExtension}`

  if (customMirror === undefined) {
    return fetch(`${OfficialMirror.R2}/${engineUrlPath}.sha256`, {
      agent: getProxyAgent(`${OfficialMirror.R2}/${engineUrlPath}`),
      timeout: 4000,
    })
      .then((r) => (r.ok ? Promise.resolve(r) : Promise.reject(r)))
      .then(() => `${OfficialMirror.R2}/${engineUrlPath}`)
      .catch(() => `${OfficialMirror.AWS}/${engineUrlPath}`)
  }

  return `${customMirror}/${engineUrlPath}`
}

export async function overwriteFile(sourcePath: string, targetPath: string) {
  // without removing the file first,
  // macOS Gatekeeper can sometimes complain
  // about incorrect binary signature and kill node process
  // https://openradar.appspot.com/FB8914243
  await removeFileIfExists(targetPath)
  await fs.promises.copyFile(sourcePath, targetPath)
}

async function removeFileIfExists(filePath: string) {
  try {
    await fs.promises.unlink(filePath)
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }
}
