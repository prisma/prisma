import os from 'os'
import makeDir from 'make-dir'
import fetch from 'node-fetch'
import findCacheDir from 'find-cache-dir'
import fs from 'fs'
import { promisify } from 'util'
import path from 'path'
import { getProxyAgent } from './getProxyAgent'
import Debug from 'debug'
const debug = Debug('fetch-engine:util')

const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

export async function getLocalLastModified(filePath: string): Promise<Date | null> {
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

export async function getRemoteLastModified(url: string): Promise<Date> {
  const response = await fetch(url, {
    method: 'HEAD',
    agent: getProxyAgent(url),
  })
  return new Date(response.headers.get('last-modified'))
}

export async function getRootCacheDir(platform: string): Promise<string> {
  if (platform === 'darwin' || platform.startsWith('linux')) {
    return path.join(os.homedir(), '.cache/prisma')
  }
  return findCacheDir({ name: 'prisma' })
}

export async function getCacheDir(channel: string, version: string, platform: string): Promise<string> {
  const rootCacheDir = await getRootCacheDir(platform)

  debug({ rootCacheDir, channel, version, platform })
  const cacheDir = path.join(rootCacheDir, channel, version, platform)
  await makeDir(cacheDir)
  return cacheDir
}

export type BinaryKind = 'query-engine' | 'migration-engine'

function rewriteKind(kind: BinaryKind) {
  if (kind === 'query-engine') {
    return 'prisma'
  }

  return kind
}

export function getDownloadUrl(channel: string, version: string, platform: string, binaryName: BinaryKind) {
  const extension = platform === 'windows' ? '.exe.gz' : '.gz'
  return `https://prisma-builds.s3-eu-west-1.amazonaws.com/${channel}/${version}/${platform}/${rewriteKind(
    binaryName,
  )}${extension}`
}
