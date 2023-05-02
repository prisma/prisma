import Debug from '@prisma/debug'
import { getNodeAPIName, getos, getPlatform, isNodeAPISupported, Platform, platforms } from '@prisma/get-platform'
import execa from 'execa'
import fs from 'fs'
import { ensureDir } from 'fs-extra'
import { bold, underline, yellow } from 'kleur/colors'
import pFilter from 'p-filter'
import path from 'path'
import tempDir from 'temp-dir'
import { promisify } from 'util'

import plusxSync from './chmod'
import { cleanupCache } from './cleanupCache'
import { downloadZip } from './downloadZip'
import { getHash } from './getHash'
import { getBar } from './log'
import { getCacheDir, getDownloadUrl, overwriteFile } from './utils'

const { enginesOverride } = require('../package.json')

const debug = Debug('prisma:download')
const exists = promisify(fs.exists)

const channel = 'master'
export enum BinaryType {
  QueryEngineBinary = 'query-engine',
  QueryEngineLibrary = 'libquery-engine',
  MigrationEngineBinary = 'migration-engine',
}
export type BinaryDownloadConfiguration = {
  [binary in BinaryType]?: string // that is a path to the binary download location
}
export type BinaryPaths = {
  [binary in BinaryType]?: { [binaryTarget in Platform]: string } // key: target, value: path
}
export interface DownloadOptions {
  binaries: BinaryDownloadConfiguration
  binaryTargets?: Platform[]
  showProgress?: boolean
  progressCb?: (progress: number) => void
  version?: string
  skipDownload?: boolean
  failSilent?: boolean
  printVersion?: boolean
  skipCacheIntegrityCheck?: boolean
}

const BINARY_TO_ENV_VAR = {
  [BinaryType.MigrationEngineBinary]: 'PRISMA_MIGRATION_ENGINE_BINARY',
  [BinaryType.QueryEngineBinary]: 'PRISMA_QUERY_ENGINE_BINARY',
  [BinaryType.QueryEngineLibrary]: 'PRISMA_QUERY_ENGINE_LIBRARY',
}

type BinaryDownloadJob = {
  binaryName: string
  targetFolder: string
  binaryTarget: Platform
  fileName: string
  targetFilePath: string
  envVarPath: string | null
  skipCacheIntegrityCheck: boolean
}

export async function download(options: DownloadOptions): Promise<BinaryPaths> {
  if (enginesOverride?.['branch'] || enginesOverride?.['folder']) {
    // if this is true the engines have been fetched before and already cached
    // into .cache/prisma/master/_local_ for us to be able to use this version
    options.version = '_local_'
    options.skipCacheIntegrityCheck = true
  }

  // get platform
  const platform = await getPlatform()
  const os = await getos()

  if (os.targetDistro && ['nixos'].includes(os.targetDistro)) {
    console.error(`${yellow('Warning')} Precompiled engine files are not available for ${os.targetDistro}.`)
  } else if (['freebsd11', 'freebsd12', 'freebsd13', 'openbsd', 'netbsd'].includes(platform)) {
    console.error(
      `${yellow(
        'Warning',
      )} Precompiled engine files are not available for ${platform}. Read more about building your own engines at https://pris.ly/d/build-engines`,
    )
  } else if (BinaryType.QueryEngineLibrary in options.binaries) {
    isNodeAPISupported()
  }

  // no need to do anything, if there are no binaries
  if (!options.binaries || Object.values(options.binaries).length === 0) {
    return {} // we don't download anything if nothing is provided
  }

  // merge options
  const opts = {
    ...options,
    binaryTargets: options.binaryTargets ?? [platform],
    version: options.version ?? 'latest',
    binaries: mapKeys(options.binaries, (key) => engineTypeToBinaryType(key, platform)), // just necessary to support both camelCase and hyphen-case
  }

  // creates a matrix of binaries x binary targets
  const binaryJobs = Object.entries(opts.binaries).flatMap(([binaryName, targetFolder]: [string, string]) =>
    opts.binaryTargets.map((binaryTarget) => {
      const fileName = getBinaryName(binaryName, binaryTarget)
      const targetFilePath = path.join(targetFolder, fileName)
      return {
        binaryName,
        targetFolder,
        binaryTarget,
        fileName,
        targetFilePath,
        envVarPath: getBinaryEnvVarPath(binaryName),
        skipCacheIntegrityCheck: !!opts.skipCacheIntegrityCheck,
      }
    }),
  )

  if (process.env.BINARY_DOWNLOAD_VERSION) {
    opts.version = process.env.BINARY_DOWNLOAD_VERSION
  }

  if (opts.printVersion) {
    console.log(`version: ${opts.version}`)
  }

  // filter out files, which don't yet exist or have to be created
  const binariesToDownload = await pFilter(binaryJobs, async (job) => {
    const needsToBeDownloaded = await binaryNeedsToBeDownloaded(job, platform, opts.version)
    const isSupported = platforms.includes(job.binaryTarget as Platform)
    const shouldDownload =
      isSupported &&
      !job.envVarPath && // this is for custom binaries
      needsToBeDownloaded
    if (needsToBeDownloaded && !isSupported) {
      throw new Error(`Unknown binaryTarget ${job.binaryTarget} and no custom engine files were provided`)
    }
    return shouldDownload
  })

  if (binariesToDownload.length > 0) {
    const cleanupPromise = cleanupCache() // already start cleaning up while we download

    let finishBar: undefined | (() => void)
    let setProgress: undefined | ((sourcePath: string) => (progress: number) => void)

    if (opts.showProgress) {
      const collectiveBar = getCollectiveBar(opts)
      finishBar = collectiveBar.finishBar
      setProgress = collectiveBar.setProgress
    }

    await Promise.all(
      binariesToDownload.map((job) =>
        downloadBinary({
          ...job,
          version: opts.version,
          failSilent: opts.failSilent,
          progressCb: setProgress ? setProgress(job.targetFilePath) : undefined,
        }),
      ),
    )

    await cleanupPromise // make sure, that cleanup finished
    if (finishBar) {
      finishBar()
    }
  }

  const binaryPaths = binaryJobsToBinaryPaths(binaryJobs)
  const dir = eval('__dirname')

  // this is necessary for pkg
  if (dir.startsWith('/snapshot/')) {
    for (const engineType in binaryPaths) {
      const binaryTargets = binaryPaths[engineType]
      for (const binaryTarget in binaryTargets) {
        const binaryPath = binaryTargets[binaryTarget]
        binaryTargets[binaryTarget] = await maybeCopyToTmp(binaryPath)
      }
    }
  }

  return binaryPaths
}

function getCollectiveBar(options: DownloadOptions): {
  finishBar: () => void
  setProgress: (sourcePath: string) => (progress: number) => void
} {
  const hasNodeAPI = 'libquery-engine' in options.binaries
  const bar = getBar(
    `Downloading Prisma engines${hasNodeAPI ? ' for Node-API' : ''} for ${options.binaryTargets
      ?.map((p) => bold(p))
      .join(' and ')}`,
  )

  const progressMap: { [key: string]: number } = {}
  // Object.values is faster than Object.keys
  const numDownloads = Object.values(options.binaries).length * Object.values(options?.binaryTargets ?? []).length
  const setProgress =
    (sourcePath: string) =>
    (progress): void => {
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
): Promise<boolean> {
  // If there is an ENV Override and the file exists then it does not need to be downloaded
  if (job.envVarPath && fs.existsSync(job.envVarPath)) {
    return false
  }
  // 1. Check if file exists
  const targetExists = await exists(job.targetFilePath)
  // 2. If exists, check, if cached file exists and is up to date and has same hash as file.
  // If not, copy cached file over
  const cachedFile = await getCachedBinaryPath({
    ...job,
    version,
  })

  if (cachedFile) {
    // for local development, when using `enginesOverride`
    // we don't have the sha256 hash, so we can't check it
    if (job.skipCacheIntegrityCheck === true) {
      await overwriteFile(cachedFile, job.targetFilePath)

      return false
    }

    const sha256FilePath = cachedFile + '.sha256'
    if (await exists(sha256FilePath)) {
      const sha256File = await fs.promises.readFile(sha256FilePath, 'utf-8')
      const sha256Cache = await getHash(cachedFile)
      if (sha256File === sha256Cache) {
        if (!targetExists) {
          debug(`copying ${cachedFile} to ${job.targetFilePath}`)

          // TODO Remove when https://github.com/docker/for-linux/issues/1015 is fixed
          // Workaround for https://github.com/prisma/prisma/issues/7037
          await fs.promises.utimes(cachedFile, new Date(), new Date())

          await overwriteFile(cachedFile, job.targetFilePath)
        }
        const targetSha256 = await getHash(job.targetFilePath)
        if (sha256File !== targetSha256) {
          debug(`overwriting ${job.targetFilePath} with ${cachedFile} as hashes do not match`)
          await overwriteFile(cachedFile, job.targetFilePath)
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
    debug(`file ${job.targetFilePath} does not exist and must be downloaded`)

    return true
  }

  // 3. If same platform, check --version and compare to expected version
  if (job.binaryTarget === nativePlatform) {
    const currentVersion = await getVersion(job.targetFilePath, job.binaryName)

    if (currentVersion?.includes(version) !== true) {
      debug(`file ${job.targetFilePath} exists but its version is ${currentVersion} and we expect ${version}`)

      return true
    }
  }

  return false
}

export async function getVersion(enginePath: string, binaryName: string) {
  try {
    if (binaryName === BinaryType.QueryEngineLibrary) {
      void isNodeAPISupported()

      const commitHash = require(enginePath).version().commit
      return `${BinaryType.QueryEngineLibrary} ${commitHash}`
    } else {
      const result = await execa(enginePath, ['--version'])

      return result.stdout
    }
  } catch {}

  return undefined
}

export function getBinaryName(binaryName: string, platform: Platform): string {
  if (binaryName === BinaryType.QueryEngineLibrary) {
    return `${getNodeAPIName(platform, 'fs')}`
  }
  const extension = platform === 'windows' ? '.exe' : ''
  return `${binaryName}-${platform}${extension}`
}

type GetCachedBinaryOptions = BinaryDownloadJob & {
  version: string
  failSilent?: boolean
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
  const envVar = BINARY_TO_ENV_VAR[binaryName]
  if (envVar && process.env[envVar]) {
    const envVarPath = path.resolve(process.cwd(), process.env[envVar] as string)
    if (!fs.existsSync(envVarPath)) {
      throw new Error(
        `Env var ${bold(envVar)} is provided but provided path ${underline(process.env[envVar]!)} can't be resolved.`,
      )
    }
    debug(
      `Using env var ${bold(envVar)} for binary ${bold(binaryName)}, which points to ${underline(
        process.env[envVar]!,
      )}`,
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
  const { version, progressCb, targetFilePath, binaryTarget, binaryName } = options
  const downloadUrl = await getDownloadUrl('all_commits', version, binaryTarget, binaryName)

  console.log(`Downloading ${binaryName} ${version} from ${downloadUrl}`)

  const targetDir = path.dirname(targetFilePath)

  try {
    fs.accessSync(targetDir, fs.constants.W_OK)
    await ensureDir(targetDir)
  } catch (e) {
    if (options.failSilent || (e as NodeJS.ErrnoException).code !== 'EACCES') {
      return
    } else {
      throw new Error(`Can't write to ${targetDir} please make sure you install "prisma" with the right permissions.`)
    }
  }

  debug(`Downloading ${downloadUrl} to ${targetFilePath}`)

  if (progressCb) {
    progressCb(0)
  }

  const { sha256, zippedSha256 } = await downloadZip(downloadUrl, targetFilePath, progressCb)
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
  const cachedSha256ZippedPath = path.join(cacheDir, job.binaryName + '.gz.sha256')

  try {
    await overwriteFile(job.targetFilePath, cachedTargetPath)
    await fs.promises.writeFile(cachedSha256Path, sha256)
    await fs.promises.writeFile(cachedSha256ZippedPath, zippedSha256)
  } catch (e) {
    debug(e)
    // let this fail silently - the CI system may have reached the file size limit
  }
}

function engineTypeToBinaryType(engineType: string, binaryTarget: string): string {
  if (BinaryType[engineType]) {
    return BinaryType[engineType]
  }
  if (engineType === 'native') {
    return binaryTarget
  }

  return engineType
}

function mapKeys<T extends object, K extends keyof T>(
  obj: T,
  mapper: (key: K) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[mapper(key as K)] = value
    return acc
  }, {} as Record<string, any>)
}

export async function maybeCopyToTmp(file: string): Promise<string> {
  // in this case, we are in a "pkg" context with a virtual fs
  // to make this work, we need to copy the binary to /tmp and execute it from there

  const dir = eval('__dirname')
  if (dir.startsWith('/snapshot/')) {
    const targetDir = path.join(tempDir, 'prisma-binaries')
    await ensureDir(targetDir)
    const target = path.join(targetDir, path.basename(file))
    const data = await fs.promises.readFile(file)
    await fs.promises.writeFile(target, data)
    // We have to read and write until https://github.com/zeit/pkg/issues/639
    // is resolved
    // await copyFile(file, target)
    plusX(target)
    return target
  }

  return file
}

export function plusX(file): void {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) {
    return
  }
  const base8 = newMode.toString(8).slice(-3)
  fs.chmodSync(file, base8)
}
