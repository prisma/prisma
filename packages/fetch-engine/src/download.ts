import Debug from '@prisma/debug'
import { getNodeAPIName, getos, getPlatform, isNodeAPISupported, Platform, platforms } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import makeDir from 'make-dir'
import pFilter from 'p-filter'
import path from 'path'
import tempDir from 'temp-dir'
import { promisify } from 'util'

import plusxSync from './chmod'
import { cleanupCache } from './cleanupCache'
import { downloadZip } from './downloadZip'
import { flatMap } from './flatMap'
import { getHash } from './getHash'
import { getLatestTag } from './getLatestTag'
import { getBar } from './log'
import { getCacheDir, getDownloadUrl } from './util'

const debug = Debug('prisma:download')
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)
const readFile = promisify(fs.readFile)
const copyFile = promisify(fs.copyFile)
const utimes = promisify(fs.utimes)

const channel = 'master'

export enum EngineTypeEnum {
  queryEngine = 'query-engine',
  libqueryEngine = 'libquery-engine',
  migrationEngine = 'migration-engine',
  introspectionEngine = 'introspection-engine',
  prismaFmt = 'prisma-fmt',
}
export type EngineDownloadConfiguration = {
  [engineType in EngineTypeEnum]?: string // that is a path to the engine download location
}
export type EnginePaths = {
  [engineType in EngineTypeEnum]?: { [binaryTarget in Platform]: string } // key: target, value: path
}
export interface DownloadOptions {
  engines: EngineDownloadConfiguration
  binaryTargets?: Platform[]
  showProgress?: boolean
  progressCb?: (progress: number) => void
  version?: string
  skipDownload?: boolean
  failSilent?: boolean
  ignoreCache?: boolean
  printVersion?: boolean
}

const ENGINETYPE_TO_ENV_VAR = {
  [EngineTypeEnum.migrationEngine]: 'PRISMA_MIGRATION_ENGINE_BINARY',
  [EngineTypeEnum.queryEngine]: 'PRISMA_QUERY_ENGINE_BINARY',
  [EngineTypeEnum.libqueryEngine]: 'PRISMA_QUERY_ENGINE_LIBRARY',
  [EngineTypeEnum.introspectionEngine]: 'PRISMA_INTROSPECTION_ENGINE_BINARY',
  [EngineTypeEnum.prismaFmt]: 'PRISMA_FMT_BINARY',
}

type EngineDownloadJob = {
  engineName: string
  targetFolder: string
  binaryTarget: Platform
  fileName: string
  targetFilePath: string
  envVarPath: string | null
}

export async function download(options: DownloadOptions): Promise<EnginePaths> {
  // get platform
  const platform = await getPlatform()
  const os = await getos()

  if (os.distro && ['nixos'].includes(os.distro)) {
    console.error(`${chalk.yellow('Warning')} Precompiled engine files are not available for ${os.distro}.`)
  } else if (['freebsd11', 'freebsd12', 'freebsd13', 'openbsd', 'netbsd'].includes(platform)) {
    console.error(
      `${chalk.yellow(
        'Warning',
      )} Precompiled engine files are not available for ${platform}. Read more about building your own engines at https://pris.ly/d/build-engines`,
    )
  } else if (EngineTypeEnum.libqueryEngine in options.engines) {
    await isNodeAPISupported()
  }

  // no need to do anything, if there are no engines
  if (!options.engines || Object.values(options.engines).length === 0) {
    return {} // we don't download anything if nothing is provided
  }

  // merge options
  const opts = {
    ...options,
    binaryTargets: options.binaryTargets ?? [platform],
    version: options.version ?? 'latest',
    engines: mapKeys(options.engines, (key) => engineTypeToBinaryType(key, platform)), // just necessary to support both camelCase and hyphen-case
  }

  // creates a matrix of engines x binary targets
  const engineJobs = flatMap(Object.entries(opts.engines), ([engineName, targetFolder]: [string, string]) =>
    opts.binaryTargets.map((binaryTarget) => {
      const fileName =
        engineName === EngineTypeEnum.libqueryEngine
          ? getNodeAPIName(binaryTarget, 'fs')
          : getEngineFileName(engineName, binaryTarget)
      const targetFilePath = path.join(targetFolder, fileName)
      return {
        engineName,
        targetFolder,
        binaryTarget,
        fileName,
        targetFilePath,
        envVarPath: getEngineEnvVarPath(engineName),
      }
    }),
  )

  if (process.env.BINARY_DOWNLOAD_VERSION) {
    opts.version = process.env.BINARY_DOWNLOAD_VERSION // TODO rename env var
  }

  // TODO: look to remove latest, because we always pass a version
  if (opts.version === 'latest') {
    opts.version = await getLatestTag()
  }

  if (opts.printVersion) {
    console.log(`version: ${opts.version}`)
  }

  // filter out files, which don't yet exist or have to be created
  const engineFilesToDownload = await pFilter(engineJobs, async (job) => {
    const needsToBeDownloaded = await engineFileNeedsToBeDownloaded(job, platform, opts.version, opts.failSilent)
    const isSupported = platforms.includes(job.binaryTarget as Platform)
    const shouldDownload =
      isSupported &&
      !job.envVarPath && // this is for custom engines
      (opts.ignoreCache || needsToBeDownloaded) // TODO: do we need ignoreCache?
    if (needsToBeDownloaded && !isSupported) {
      throw new Error(`Unknown binaryTarget ${job.binaryTarget} and no custom engine files were provided`)
    }
    return shouldDownload
  })

  if (engineFilesToDownload.length > 0) {
    const cleanupPromise = cleanupCache() // already start cleaning up while we download

    let finishBar: undefined | (() => void)
    let setProgress: undefined | ((sourcePath: string) => (progress: number) => void)

    if (opts.showProgress) {
      const collectiveBar = getCollectiveBar(opts)
      finishBar = collectiveBar.finishBar
      setProgress = collectiveBar.setProgress
    }

    await Promise.all(
      engineFilesToDownload.map((job) =>
        downloadEngine({
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

  const enginePaths = engineJobsToEnginePaths(engineJobs)
  const dir = eval('__dirname')

  // this is necessary for pkg
  if (dir.startsWith('/snapshot/')) {
    for (const engineType in enginePaths) {
      const binaryTargets = enginePaths[engineType]
      for (const binaryTarget in binaryTargets) {
        const binaryPath = binaryTargets[binaryTarget]
        binaryTargets[binaryTarget] = await maybeCopyToTmp(binaryPath)
      }
    }
  }

  return enginePaths
}

function getCollectiveBar(options: DownloadOptions): {
  finishBar: () => void
  setProgress: (sourcePath: string) => (progress: number) => void
} {
  const hasNodeAPI = 'libquery-engine' in options.engines
  const bar = getBar(
    `Downloading Prisma engines${hasNodeAPI ? ' for Node-API' : ''} for ${options.binaryTargets
      ?.map((p) => chalk.bold(p))
      .join(' and ')}`,
  )

  const progressMap: { [key: string]: number } = {}
  // Object.values is faster than Object.keys
  const numDownloads = Object.values(options.engines).length * Object.values(options?.binaryTargets ?? []).length
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

function engineJobsToEnginePaths(jobs: EngineDownloadJob[]): EnginePaths {
  return jobs.reduce<EnginePaths>((acc, job) => {
    if (!acc[job.engineName]) {
      acc[job.engineName] = {}
    }

    // if an env var path has been provided, prefer that one
    acc[job.engineName][job.binaryTarget] = job.envVarPath || job.targetFilePath

    return acc
  }, {} as EnginePaths)
}

async function engineFileNeedsToBeDownloaded(
  job: EngineDownloadJob,
  nativePlatform: string,
  version: string,
  failSilent?: boolean,
): Promise<boolean> {
  // If there is an ENV Override and the file exists then it does not need to be downloaded
  if (job.envVarPath && fs.existsSync(job.envVarPath)) {
    return false
  }
  // 1. Check if file exists
  const targetExists = await exists(job.targetFilePath)
  // 2. If exists, check, if cached file exists and is up to date and has same hash as file.
  // If not, copy cached file over
  const cachedFile = await getCachedEngineFilePath({
    ...job,
    version,
    failSilent,
  })

  if (cachedFile) {
    const sha256FilePath = cachedFile + '.sha256'
    if (await exists(sha256FilePath)) {
      const sha256File = await readFile(sha256FilePath, 'utf-8')
      const sha256Cache = await getHash(cachedFile)
      if (sha256File === sha256Cache) {
        if (!targetExists) {
          debug(`copying ${cachedFile} to ${job.targetFilePath}`)

          // TODO Remove when https://github.com/docker/for-linux/issues/1015 is fixed
          // Workaround for https://github.com/prisma/prisma/issues/7037
          await utimes(cachedFile, new Date(), new Date())

          await copyFile(cachedFile, job.targetFilePath)
        }
        const targetSha256 = await getHash(job.targetFilePath)
        if (sha256File !== targetSha256) {
          debug(`overwriting ${job.targetFilePath} with ${cachedFile} as hashes do not match`)
          await copyFile(cachedFile, job.targetFilePath)
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

  // 3. If same platform, always check --version
  if (job.binaryTarget === nativePlatform && job.engineName !== EngineTypeEnum.libqueryEngine) {
    const works = await checkVersionCommand(job.targetFilePath)
    return !works
  } // TODO: this is probably not useful anymore

  return false
}

export async function getVersion(enginePath: string): Promise<string> {
  const result = await execa(enginePath, ['--version'])

  return result.stdout
}

export async function checkVersionCommand(enginePath: string): Promise<boolean> {
  try {
    const version = await getVersion(enginePath)

    return version.length > 0
  } catch (e) {
    return false
  }
}

export function getEngineFileName(engineName: string, platform: Platform): string {
  if (engineName === EngineTypeEnum.libqueryEngine) {
    return `${getNodeAPIName(platform, 'url')}`
  }
  const extension = platform === 'windows' ? '.exe' : ''
  return `${engineName}-${platform}${extension}`
}

type GetCachedEngineFilePathOptions = EngineDownloadJob & {
  version: string
  failSilent?: boolean
}

async function getCachedEngineFilePath({
  version,
  binaryTarget,
  engineName,
}: GetCachedEngineFilePathOptions): Promise<string | null> {
  const cacheDir = await getCacheDir(channel, version, binaryTarget)
  if (!cacheDir) {
    return null
  }

  const cachedTargetPath = path.join(cacheDir, engineName)

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

export function getEngineEnvVarPath(engineName: string): string | null {
  const envVar = ENGINETYPE_TO_ENV_VAR[engineName]
  if (envVar && process.env[envVar]) {
    const envVarPath = path.resolve(process.cwd(), process.env[envVar] as string)
    if (!fs.existsSync(envVarPath)) {
      throw new Error(
        `Env var ${chalk.bold(envVar)} is provided but provided path ${chalk.underline(
          process.env[envVar],
        )} can't be resolved.`,
      )
    }
    debug(
      `Using env var ${chalk.bold(envVar)} for engine ${chalk.bold(engineName)}, which points to ${chalk.underline(
        process.env[envVar],
      )}`,
    )
    return envVarPath
  }

  return null
}

type DownloadEngineOptions = EngineDownloadJob & {
  version: string
  progressCb?: (progress: number) => void
  failSilent?: boolean
}

async function downloadEngine(options: DownloadEngineOptions): Promise<void> {
  const { version, progressCb, targetFilePath, binaryTarget, engineName } = options
  const downloadUrl = getDownloadUrl('all_commits', version, binaryTarget, engineName)

  const targetDir = path.dirname(targetFilePath)

  try {
    fs.accessSync(targetDir, fs.constants.W_OK)
    await makeDir(targetDir)
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
  job: EngineDownloadJob,
  version: string,
  sha256: string,
  zippedSha256: string,
): Promise<void> {
  // always fail silent, as the cache is optional
  const cacheDir = await getCacheDir(channel, version, job.binaryTarget)
  if (!cacheDir) {
    return
  }

  const cachedTargetPath = path.join(cacheDir, job.engineName)
  const cachedSha256Path = path.join(cacheDir, job.engineName + '.sha256')
  const cachedSha256ZippedPath = path.join(cacheDir, job.engineName + '.gz.sha256')

  try {
    await copyFile(job.targetFilePath, cachedTargetPath)
    await writeFile(cachedSha256Path, sha256)
    await writeFile(cachedSha256ZippedPath, zippedSha256)
  } catch (e) {
    debug(e)
    // let this fail silently - the CI system may have reached the file size limit
  }
}

// ???? What is this doing?
function engineTypeToBinaryType(engineType: string, binaryTarget: string): string {
  if (EngineTypeEnum[engineType]) {
    return EngineTypeEnum[engineType]
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
  // to make this work, we need to copy the engine file to /tmp and execute it from there

  const dir = eval('__dirname')
  if (dir.startsWith('/snapshot/')) {
    const targetDir = path.join(tempDir, 'prisma-engines')
    await makeDir(targetDir)
    const target = path.join(targetDir, path.basename(file))
    const data = await readFile(file)
    await writeFile(target, data)
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
