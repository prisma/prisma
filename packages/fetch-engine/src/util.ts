import Debug from '@prisma/debug'
import { getNodeAPIName, Platform } from '@prisma/get-platform'
import findCacheDir from 'find-cache-dir'
import fs from 'fs'
import makeDir from 'make-dir'
import os from 'os'
import path from 'path'

import { EngineTypeEnum } from './download'

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
      await makeDir(`/tmp/prisma-download`)
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
      await makeDir(cacheDir)
    }
  } catch (e) {
    debug('The following error is being caught and just there for debugging:')
    debug(e)
    return null
  }
  return cacheDir
}

export function getDownloadUrl(
  channel: string,
  version: string,
  platform: Platform,
  engineName: string,
  extension = '.gz',
): string {
  const baseUrl =
    process.env.PRISMA_BINARIES_MIRROR || // TODO: remove this
    process.env.PRISMA_ENGINES_MIRROR ||
    'https://binaries.prisma.sh'
  const finalExtension =
    platform === 'windows' && EngineTypeEnum.libqueryEngine !== engineName ? `.exe${extension}` : extension
  if (engineName === EngineTypeEnum.libqueryEngine) {
    engineName = getNodeAPIName(platform, 'url')
  }

  return `${baseUrl}/${channel}/${version}/${platform}/${engineName}${finalExtension}`
}
