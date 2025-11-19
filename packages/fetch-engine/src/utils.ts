import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Debug from '@prisma/debug'
import { BinaryTarget } from '@prisma/get-platform'
import findCacheDir from 'find-cache-dir'
import { ensureDir } from 'fs-extra'

const debug = Debug('prisma:fetch-engine:cache-dir')
const DEFAULT_ENGINE_BASE_URL = 'https://binaries.prisma.sh'
const STRICT_MIRROR_ENV_VAR = 'PRISMA_ENGINES_STRICT_MIRROR'

export type EngineDownloadSource = {
  baseUrl: string
  url: string
  isCustomMirror: boolean
}

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
  return process.env.XDG_CACHE_HOME
    ? path.join(process.env.XDG_CACHE_HOME, 'prisma')
    : path.join(os.homedir(), '.cache/prisma')
}

export async function getCacheDir(channel: string, version: string, binaryTarget: string): Promise<string | null> {
  const rootCacheDir = await getRootCacheDir()
  if (!rootCacheDir) {
    return null
  }
  const cacheDir = path.join(rootCacheDir, channel, version, binaryTarget)
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

export function getDownloadUrl(options: GetDownloadUrlOptions): string {
  const [firstMirror] = getEngineMirrorBaseUrls()
  return buildDownloadUrl(firstMirror, options)
}

export function getDownloadUrls(options: GetDownloadUrlOptions): EngineDownloadSource[] {
  const customMirrors = new Set(getCustomEngineMirrorBaseUrls())

  return getEngineMirrorBaseUrls().map((baseUrl) => ({
    baseUrl,
    url: buildDownloadUrl(baseUrl, options),
    isCustomMirror: customMirrors.has(baseUrl),
  }))
}

export function hasCustomEngineMirror(): boolean {
  return getCustomEngineMirrorBaseUrls().length > 0
}

export function isStrictMirrorEnabled(): boolean {
  return isTruthyEnv(process.env[STRICT_MIRROR_ENV_VAR])
}

type GetDownloadUrlOptions = {
  channel: string
  version: string
  binaryTarget: BinaryTarget
  binaryName: string
  extension?: string
}

function getCustomEngineMirrorBaseUrls(): string[] {
  return dedupe(
    [process.env.PRISMA_BINARIES_MIRROR, process.env.PRISMA_ENGINES_MIRROR].filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    ),
  )
}

function getEngineMirrorBaseUrls(): string[] {
  const customMirrors = getCustomEngineMirrorBaseUrls()
  if (customMirrors.length === 0) {
    return [DEFAULT_ENGINE_BASE_URL]
  }

  return customMirrors.includes(DEFAULT_ENGINE_BASE_URL) ? customMirrors : [...customMirrors, DEFAULT_ENGINE_BASE_URL]
}

function buildDownloadUrl(
  baseUrl: string,
  { channel, version, binaryTarget, binaryName, extension = '.gz' }: GetDownloadUrlOptions,
) {
  const finalExtension = binaryTarget === 'windows' ? `.exe${extension}` : extension
  return `${baseUrl}/${channel}/${version}/${binaryTarget}/${binaryName}${finalExtension}`
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function isTruthyEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false'
}

export async function overwriteFile(sourcePath: string, targetPath: string) {
  // without removing the file first,
  // macOS Gatekeeper can sometimes complain
  // about incorrect binary signature and kill node process
  // https://openradar.appspot.com/FB8914243
  if (os.platform() === 'darwin') {
    await removeFileIfExists(targetPath)
    await fs.promises.copyFile(sourcePath, targetPath)
  } else {
    const tempPath = `${targetPath}.tmp${process.pid}`
    await fs.promises.copyFile(sourcePath, tempPath)
    await fs.promises.rename(tempPath, targetPath)
  }
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
