import fs from 'fs'
import { promisify } from 'util'
import chalk from 'chalk'

// Packages
import path from 'path'
import Debug from '@prisma/debug'
import makeDir from 'make-dir'
import execa from 'execa'
import pFilter from 'p-filter'
import hasha from 'hasha'

// Utils
import { getBar } from './log'
import plusxSync from './chmod'
import { copy } from './copy'
import { getPlatform, Platform, platforms, getos } from '@prisma/get-platform'
import { downloadZip } from './downloadZip'
import { getCacheDir, getDownloadUrl } from './util'
import { cleanupCache } from './cleanupCache'
import { flatMap } from './flatMap'
import { getLatestTag } from './getLatestTag'

const debug = Debug('download')
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)

const channel = 'master'
export interface BinaryDownloadConfiguration {
  'query-engine'?: string
  'migration-engine'?: string
  'introspection-engine'?: string
  'prisma-fmt'?: string
}

export interface DownloadOptions {
  binaries: BinaryDownloadConfiguration
  binaryTargets?: Platform[]
  showProgress?: boolean
  progressCb?: (progress: number) => void
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
  'prisma-fmt'?: { [binaryTarget: string]: string }
}

const binaryToEnvVar = {
  'migration-engine': 'PRISMA_MIGRATION_ENGINE_BINARY',
  'query-engine': 'PRISMA_QUERY_ENGINE_BINARY',
  'introspection-engine': 'PRISMA_INTROSPECTION_ENGINE_BINARY',
  'prisma-fmt': 'PRISMA_FMT_BINARY',
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
  const os = await getos()

  if (['arm', 'nixos'].includes(os.distro)) {
    console.error(
      `${chalk.yellow('Warning')} Precompiled binaries are not available for ${
        os.distro
      }.`,
    )
  } else if (['freebsd', 'openbsd', 'netbsd'].includes(platform)) {
    console.error(
      `${chalk.yellow(
        'Warning',
      )} Precompiled binaries are not available for ${platform}.`,
    )
  }

  // no need to do anything, if there are no binaries
  if (!options.binaries || Object.values(options.binaries).length === 0) {
    return {}
  }

  if (options.binaryTargets && Array.isArray(options.binaryTargets)) {
    const unknownTargets = options.binaryTargets.filter(
      (t) => !platforms.includes(t),
    )
    if (unknownTargets.length > 0) {
      throw new Error(`Unknown binaryTargets ${unknownTargets.join(', ')}`)
    }
  }

  // merge options
  options = {
    binaryTargets: [platform],
    version: 'latest',
    ...options,
    binaries: mapKeys(options.binaries, (key) =>
      engineTypeToBinaryType(key, platform),
    ), // just necessary to support both camelCase and hyphen-case
  }

  const binaryJobs: Array<BinaryDownloadJob> = flatMap(
    Object.entries(options.binaries),
    ([binaryName, targetFolder]) =>
      options.binaryTargets.map((binaryTarget) => {
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
    options.version = await getLatestTag()
  }

  if (options.printVersion) {
    console.log(`version: ${options.version}`)
  }

  // filter out files, which don't yet exist or have to be created
  const binariesToDownload = await pFilter(binaryJobs, async (job) => {
    const needsToBeDownloaded = await binaryNeedsToBeDownloaded(
      job,
      platform,
      options.version,
      options.failSilent,
    )
    return !job.envVarPath && (options.ignoreCache || needsToBeDownloaded)
  })

  if (binariesToDownload.length > 0) {
    const cleanupPromise = cleanupCache() // already start cleaning up while we download

    let finishBar: undefined | (() => void)
    let setProgress:
      | undefined
      | ((sourcePath: string) => (progress: number) => void)

    if (options.showProgress) {
      const collectiveBar = getCollectiveBar(options)
      finishBar = collectiveBar.finishBar
      setProgress = collectiveBar.setProgress
    }

    // Node 14 for whatever reason can't handle concurrent writes
    // if (process.version.startsWith('v14')) {
    //   for (const job of binariesToDownload) {
    //     await downloadBinary({
    //       ...job,
    //       version: options.version,
    //       failSilent: options.failSilent,
    //       progressCb: setProgress ? setProgress(job.targetFilePath) : undefined,
    //     })
    //   }
    // } else {
    await Promise.all(
      binariesToDownload.map((job) =>
        downloadBinary({
          ...job,
          version: options.version,
          failSilent: options.failSilent,
          progressCb: setProgress ? setProgress(job.targetFilePath) : undefined,
        }),
      ),
    )
    // }

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
  const bar = getBar(
    `Downloading Prisma engines for ${options.binaryTargets
      .map((p) => chalk.bold(p))
      .join(' and ')}`,
  )

  const progressMap: { [key: string]: number } = {}
  // Object.values is faster than Object.keys
  const numDownloads =
    Object.values(options.binaries).length *
    Object.values(options.binaryTargets).length
  const setProgress = (sourcePath: string) => (progress): void => {
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
    finishBar: (): void => {
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

async function binaryNeedsToBeDownloaded(
  job: BinaryDownloadJob,
  nativePlatform: string,
  version: string,
  failSilent: boolean,
): Promise<boolean> {
  // 1. Check if file exists
  const targetExists = await exists(job.targetFilePath)

  // 2. If exists, check, if cached file exists and is up to date and has same hash as file.
  // If not, copy cached file over
  const cachedFile = await getCachedBinaryPath({
    ...job,
    version,
    failSilent,
  })

  if (cachedFile) {
    const sha256FilePath = cachedFile + '.sha256'
    if (await exists(sha256FilePath)) {
      const sha256File = await readFile(sha256FilePath, 'utf-8')
      // TODO: Use `fromFile` as soon as https://github.com/nodejs/node/issues/33263 is fixed
      const sha256Cache = await hasha.fromFileSync(cachedFile, {
        algorithm: 'sha256',
      })
      if (sha256File === sha256Cache) {
        if (!targetExists) {
          await copy(cachedFile, job.targetFilePath)
        }
        // TODO: Use `fromFile` as soon as https://github.com/nodejs/node/issues/33263 is fixed
        const targetSha256 = await hasha.fromFileSync(job.targetFilePath, {
          algorithm: 'sha256',
        })
        if (sha256File !== targetSha256) {
          await copy(cachedFile, job.targetFilePath)
        } else {
        }
        return false
      } else {
        return true
      }
    } else {
      return true
    }
  }

  // If there is no cache and the file doesn't exist, we for sure need to download it
  if (!targetExists) {
    return true
  }

  // 3. If same platform, always check --version
  if (job.binaryTarget === nativePlatform) {
    const works = await checkVersionCommand(job.targetFilePath)
    return !works
  }

  return false
}

export async function getVersion(enginePath: string): Promise<string> {
  const result = await execa(enginePath, ['--version'])

  return result.stdout
}

export async function checkVersionCommand(
  enginePath: string,
): Promise<boolean> {
  try {
    const version = await getVersion(enginePath)

    return version.length > 0
  } catch (e) {
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

  if (await exists(cachedTargetPath)) {
    return cachedTargetPath
  }

  return null
}

export function getBinaryEnvVarPath(binaryName: string): string | null {
  const envVar = binaryToEnvVar[binaryName]
  if (envVar && process.env[envVar]) {
    const envVarPath = path.resolve(process.cwd(), process.env[envVar])
    if (!fs.existsSync(envVarPath)) {
      throw new Error(
        `Env var ${chalk.bold(
          envVar,
        )} is provided but provided path ${chalk.underline(
          process.env[envVar],
        )} can't be resolved.`,
      )
    }
    debug(
      `Using env var ${chalk.bold(envVar)} for binary ${chalk.bold(
        binaryName,
      )}, which points to ${chalk.underline(process.env[envVar])}`,
    )
    return envVarPath
  }

  return null
}

type DownloadBinaryOptions = BinaryDownloadJob & {
  version: string
  progressCb?: (progress: number) => void
  failSilent?: boolean
}
async function downloadBinary(options: DownloadBinaryOptions): Promise<void> {
  const {
    version,
    progressCb,
    targetFilePath,
    binaryTarget,
    binaryName,
  } = options
  const downloadUrl = getDownloadUrl(
    'all_commits',
    version,
    binaryTarget,
    binaryName,
  )

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

  const { sha256, zippedSha256 } = await downloadZip(
    downloadUrl,
    targetFilePath,
    progressCb,
  )
  if (progressCb) {
    progressCb(1)
  }

  if (process.platform !== 'win32') {
    plusxSync(targetFilePath)
  }

  // Cache result
  await saveFileToCache(options, version, sha256, zippedSha256)
}

async function saveFileToCache(
  job: BinaryDownloadJob,
  version: string,
  sha256: string,
  zippedSha256: string,
): Promise<void> {
  // always fail silent, as the cache is optional
  const cacheDir = await getCacheDir(channel, version, job.binaryTarget)
  if (!cacheDir) {
    return
  }

  const cachedTargetPath = path.join(cacheDir, job.binaryName)
  const cachedSha256Path = path.join(cacheDir, job.binaryName + '.sha256')
  const cachedSha256ZippedPath = path.join(
    cacheDir,
    job.binaryName + '.gz.sha256',
  )

  try {
    await copy(job.targetFilePath, cachedTargetPath)
    await writeFile(cachedSha256Path, sha256)
    await writeFile(cachedSha256ZippedPath, zippedSha256)
  } catch (e) {
    debug(e)
    // let this fail silently - the CI system may have reached the file size limit
  }
}

function engineTypeToBinaryType(
  engineType: string,
  binaryTarget: string,
): string {
  if (engineType === 'introspectionEngine') {
    return 'introspection-engine'
  }

  if (engineType === 'migrationEngine') {
    return 'migration-engine'
  }

  if (engineType === 'queryEngine') {
    return 'query-engine'
  }

  if (engineType === 'prismaFmt') {
    return 'prisma-fmt'
  }

  if (engineType === 'native') {
    return binaryTarget
  }

  return engineType
}

function mapKeys<T extends object>(
  obj: T,
  mapper: (key: keyof T) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[mapper(key as keyof T)] = value
    return acc
  }, {})
}
