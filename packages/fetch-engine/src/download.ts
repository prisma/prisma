import fs from 'fs'
import { promisify } from 'util'
import chalk from 'chalk'

// Packages
import path from 'path'
import Debug from 'debug'
import makeDir from 'make-dir'
import execa from 'execa'
import pFilter from 'p-filter'

// Utils
import { getBar } from './log'
import plusxSync from './chmod'
import { copy } from './copy'
import { getPlatform, Platform, platforms } from '@prisma/get-platform'
import { downloadZip } from './downloadZip'
import { getCacheDir, getLocalLastModified, getRemoteLastModified, getDownloadUrl } from './util'
import { cleanupCache } from './cleanupCache'
import { flatMap } from './flatMap'
import { getLatestAlphaTag } from './getLatestAlphaTag'

const debug = Debug('download')
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const stat = promisify(fs.stat)

const channel = 'master'
export interface BinaryDownloadConfiguration {
  'query-engine'?: string
  'migration-engine'?: string
  'introspection-engine'?: string
}

export interface DownloadOptions {
  binaries: BinaryDownloadConfiguration
  binaryTargets?: Platform[]
  showProgress?: boolean
  progressCb?: (progress: number) => any
  version?: string
  skipDownload?: boolean
  failSilent?: boolean
  ignoreCache?: boolean
  printVersion?: boolean
}

export type BinaryPaths = {
  'migration-engine'?: { [binaryTarget: string]: string } // key: target, value: path
  'query-engine'?: { [binaryTarget: string]: string }
  'introspection-engine'?: { [binaryTarget: string]: string }
}

const binaryToEnvVar = {
  'migration-engine': 'PRISMA_MIGRATION_ENGINE_BINARY',
  'query-engine': 'PRISMA_QUERY_ENGINE_BINARY',
  'introspection-engine': 'PRISMA_INTROSPECTION_ENGINE_BINARY',
}

type BinaryDownloadJob = {
  binaryName: string
  targetFolder: string
  binaryTarget: string
  fileName: string
  targetFilePath: string
  envVarPath: string
}

export async function download(options: DownloadOptions): Promise<BinaryPaths> {
  // get platform
  const platform = await getPlatform()

  // no need to do anything, if there are no binaries
  if (!options.binaries || Object.values(options.binaries).length === 0) {
    return {}
  }

  if (options.binaryTargets && Array.isArray(options.binaryTargets)) {
    const unknownTargets = options.binaryTargets.filter(t => !platforms.includes(t))
    if (unknownTargets.length > 0) {
      throw new Error(`Unknown binaryTargets ${unknownTargets.join(', ')}`)
    }
  }

  // merge options
  options = {
    binaryTargets: [platform],
    version: 'latest',
    ...options,
    binaries: mapKeys(options.binaries, key => engineTypeToBinaryType(key, platform)), // just necessary to support both camelCase and hyphen-case
  }

  const binaryJobs: Array<BinaryDownloadJob> = flatMap(Object.entries(options.binaries), ([binaryName, targetFolder]) =>
    options.binaryTargets.map(binaryTarget => {
      const fileName = getBinaryName(binaryName, binaryTarget)
      return {
        binaryName,
        targetFolder,
        binaryTarget,
        fileName,
        targetFilePath: path.join(targetFolder, fileName),
        envVarPath: getBinaryEnvVarPath(binaryName),
      }
    }),
  )

  if (options.version === 'latest') {
    options.version = await getLatestAlphaTag()
  }

  if (options.printVersion) {
    console.log(`version: ${options.version}`)
  }

  // filter out files, which don't yet exist or have to be created
  const binariesToDownload = await pFilter(binaryJobs, async job => {
    const needsToBeDownloaded = await binaryNeedsToBeDownloaded(job, platform, options.version, options.failSilent)
    debug({ needsToBeDownloaded })
    return !job.envVarPath && (options.ignoreCache || needsToBeDownloaded)
  })

  if (binariesToDownload.length > 0) {
    const cleanupPromise = cleanupCache() // already start cleaning up while we download

    let finishBar: undefined | (() => void)
    let setProgress: undefined | ((sourcePath: string) => (progress: number) => void)

    if (options.showProgress) {
      const collectiveBar = getCollectiveBar(options)
      finishBar = collectiveBar.finishBar
      setProgress = collectiveBar.setProgress
    }

    await Promise.all(
      binariesToDownload.map(job =>
        downloadBinary({
          ...job,
          version: options.version,
          failSilent: options.failSilent,
          progressCb: setProgress ? setProgress(job.targetFilePath) : undefined,
        }),
      ),
    )

    await cleanupPromise // make sure, that cleanup finished
    if (finishBar) {
      finishBar()
    }
  }

  return binaryJobsToBinaryPaths(binaryJobs)
}

function getCollectiveBar(
  options: DownloadOptions,
): {
  finishBar: () => void
  setProgress: (sourcePath: string) => (progress: number) => void
} {
  const bar = getBar(`Downloading Prisma engines for ${options.binaryTargets.map(p => chalk.bold(p)).join(' and ')}`)

  const progressMap: { [key: string]: number } = {}
  // Object.values is faster than Object.keys
  const numDownloads = Object.values(options.binaries).length * Object.values(options.binaryTargets).length
  const setProgress = (sourcePath: string) => progress => {
    progressMap[sourcePath] = progress
    const progressValues = Object.values(progressMap)
    const totalProgress =
      progressValues.reduce((acc, curr) => {
        return acc + curr
      }, 0) / numDownloads
    if (options.progressCb) {
      options.progressCb(totalProgress)
    }
    if (bar) {
      bar.update(totalProgress)
    }
  }

  return {
    setProgress,
    finishBar: () => {
      bar.update(1)
      bar.terminate()
    },
  }
}

function binaryJobsToBinaryPaths(jobs: BinaryDownloadJob[]): BinaryPaths {
  return jobs.reduce<BinaryPaths>((acc, job) => {
    if (!acc[job.binaryName]) {
      acc[job.binaryName] = {}
    }

    // if an env var path has been provided, prefer that one
    acc[job.binaryName][job.binaryTarget] = job.envVarPath || job.targetFilePath

    return acc
  }, {} as BinaryPaths)
}

async function fileSize(name: string): Promise<number | null> {
  try {
    const statResult = await stat(name)
    return statResult.size
  } catch (e) {
    return null
  }
}

async function binaryNeedsToBeDownloaded(
  job: BinaryDownloadJob,
  nativePlatform: string,
  version: string,
  failSilent: boolean,
): Promise<boolean> {
  // 1. Check if file exists
  const fileExists = await exists(job.targetFilePath)

  // 2. If exists, check, if cached file exists and is up to date and has same file size as file.
  // If not, copy cached file over
  const cachedFile = await getCachedBinaryPath({
    ...job,
    version,
    failSilent,
  })

  if (cachedFile) {
    debug({ cachedFile })
    if (!fileExists) {
      await copy(cachedFile, job.targetFilePath)
      return false
    }
    const [cachedFileSize, targetFileSize] = await Promise.all([fileSize(cachedFile), fileSize(job.targetFilePath)])
    debug({ cachedFileSize, targetFileSize })
    if (cachedFileSize && targetFileSize && cachedFileSize !== targetFileSize) {
      await copy(cachedFile, job.targetFilePath)
      return false
    }
  }

  // If there is no cache and the file doesn't exist, we for sure need to download it
  if (!fileExists) {
    return true
  }

  // 3. If same platform, always check --version
  if (job.binaryTarget === nativePlatform) {
    const works = await checkVersionCommand(job.targetFilePath)
    debug({ works })
    return !works
  }

  return false
}

export async function getVersion(enginePath: string): Promise<string> {
  const result = await execa(enginePath, ['--version'])

  debug(`Getting version of ${enginePath}. Result: `, result)

  return result.stdout
}

export async function checkVersionCommand(enginePath: string): Promise<boolean> {
  try {
    const version = await getVersion(enginePath)

    debug(`Getting version of ${enginePath}. Result: `, version)
    return version.length > 0
  } catch (e) {
    debug(`Version command does not work`, e)
    return false
  }
}

export function getBinaryName(binaryName: string, platform: string): string {
  const extension = platform === 'windows' ? '.exe' : ''
  return `${binaryName}-${platform}${extension}`
}

type GetCachedBinaryOptions = BinaryDownloadJob & {
  version: string
  failSilent: boolean
}

async function getCachedBinaryPath({
  version,
  binaryTarget,
  binaryName,
}: GetCachedBinaryOptions): Promise<string | null> {
  const cacheDir = await getCacheDir(channel, version, binaryTarget)
  if (!cacheDir) {
    return null
  }

  const cachedTargetPath = path.join(cacheDir, binaryName)

  if (!fs.existsSync(cachedTargetPath)) {
    return null
  }

  // All versions not called 'latest' are unique
  // only latest needs more checks
  if (version !== 'latest') {
    return cachedTargetPath
  }

  const cachedLastModifiedPath = path.join(cacheDir, 'lastModified-' + binaryName)

  const [cachedPrismaExists, localLastModified] = await Promise.all([
    exists(cachedTargetPath),
    getLocalLastModified(cachedLastModifiedPath),
  ])

  const downloadUrl = getDownloadUrl(channel, version, binaryTarget, binaryName)

  if (cachedPrismaExists && localLastModified) {
    const remoteLastModified = await getRemoteLastModified(downloadUrl)
    if (localLastModified >= remoteLastModified) {
      return cachedTargetPath
    }
  }

  return null
}

export function getBinaryEnvVarPath(binaryName: string): string | null {
  const envVar = binaryToEnvVar[binaryName]
  if (envVar && process.env[envVar]) {
    const envVarPath = path.resolve(process.cwd(), process.env[envVar])
    if (!fs.existsSync(envVarPath)) {
      throw new Error(
        `Env var ${chalk.bold(envVar)} is provided but provided path ${chalk.underline(
          process.env[envVar],
        )} can't be resolved.`,
      )
    }
    debug(
      `Using env var ${chalk.bold(envVar)} for binary ${chalk.bold(binaryName)}, which points to ${chalk.underline(
        process.env[envVar],
      )}`,
    )
    return envVarPath
  }

  return null
}

type DownloadBinaryOptions = BinaryDownloadJob & {
  version: string
  progressCb?: (progress: number) => any
  failSilent?: boolean
}
async function downloadBinary(options: DownloadBinaryOptions) {
  const { version, progressCb, failSilent, targetFilePath, binaryTarget, binaryName } = options
  const downloadUrl = getDownloadUrl(channel, version, binaryTarget, binaryName)

  const targetDir = path.dirname(targetFilePath)

  try {
    fs.accessSync(targetDir, fs.constants.W_OK)
    await makeDir(targetDir)
  } catch (e) {
    if (options.failSilent || e.code !== 'EACCES') {
      return
    } else {
      throw new Error(
        `Can't write to ${targetDir} please make sure you install "@prisma/cli" with the right permissions.`,
      )
    }
  }

  debug(`Downloading ${downloadUrl} to ${targetFilePath}`)

  if (progressCb) {
    progressCb(0)
  }

  debug(`Downloading zip`)
  const lastModified = await downloadZip(downloadUrl, targetFilePath, progressCb)
  if (progressCb) {
    progressCb(1)
  }

  if (process.platform !== 'win32') {
    plusxSync(targetFilePath)
  }

  // Cache result
  await saveFileToCache(options, version, lastModified)
}

async function saveFileToCache(job: BinaryDownloadJob, version: string, lastModified: string): Promise<void> {
  // always fail silent, as the cache is optional
  const cacheDir = await getCacheDir(channel, version, job.binaryTarget)
  if (!cacheDir) {
    return
  }

  const cachedTargetPath = path.join(cacheDir, job.binaryName)
  const cachedLastModifiedPath = path.join(cacheDir, 'lastModified-' + job.binaryName)

  try {
    await copy(job.targetFilePath, cachedTargetPath)
    await writeFile(cachedLastModifiedPath, lastModified)
  } catch (e) {
    debug(e)
    // let this fail silently - the CI system may have reached the file size limit
  }
}

function engineTypeToBinaryType(engineType: string, binaryTarget: string): string {
  if (engineType === 'introspectionEngine') {
    return 'introspection-engine'
  }

  if (engineType === 'migrationEngine') {
    return 'migration-engine'
  }

  if (engineType === 'queryEngine') {
    return 'query-engine'
  }

  if (engineType === 'native') {
    return binaryTarget
  }

  return engineType
}

function mapKeys<T extends object>(obj: T, mapper: (key: keyof T) => string): any {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[mapper(key as keyof T)] = value
    return acc
  }, {})
}
