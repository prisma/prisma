import Debug from '@prisma/debug'
import { assertNodeAPISupported, getNodeAPIName, getos, getPlatform, Platform, platforms } from '@prisma/get-platform'
import fs from 'fs'
import { ensureDir } from 'fs-extra'
import { bold, yellow } from 'kleur/colors'
import pFilter from 'p-filter'
import path from 'path'
import tempDir from 'temp-dir'
import tempy from 'tempy'

import { BinaryType } from './BinaryType'
import { chmodPlusX } from './chmodPlusX'
import { cleanupCache } from './cleanupCache'
import { downloadZip } from './downloadZip'
import { allEngineEnvVarsSet, getBinaryEnvVarPath } from './env'
import { getHash } from './getHash'
import { getBar } from './log'
import { getCacheDir, getDownloadUrl, getSha256Paths, overwriteFile, removeFileIfExists } from './utils'

const { enginesOverride } = require('../package.json')

const debug = Debug('prisma:fetch-engine:download')
const channel = 'master'

// matches `/snapshot/` or `C:\\snapshot\\` or `C:/snapshot/` for vercel's pkg apps
export const vercelPkgPathRegex = /^((\w:[\\\/])|\/)snapshot[\/\\]/

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

type BinaryDownloadJob = {
  binaryName: string
  targetFolder: string
  binaryTarget: Platform
  fileName: string
  targetFilePath: string
  envVarPath: string | undefined
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

  if (os.targetDistro && ['nixos'].includes(os.targetDistro) && !allEngineEnvVarsSet(Object.keys(options.binaries))) {
    console.error(
      `${yellow('Warning')} Precompiled engine files are not available for ${
        os.targetDistro
      }, please provide the paths via environment variables, see https://pris.ly/d/custom-engines`,
    )
  } else if (['freebsd11', 'freebsd12', 'freebsd13', 'openbsd', 'netbsd'].includes(platform)) {
    console.error(
      `${yellow(
        'Warning',
      )} Precompiled engine files are not available for ${platform}. Read more about building your own engines at https://pris.ly/d/build-engines`,
    )
  } else if (BinaryType.QueryEngineLibrary in options.binaries) {
    assertNodeAPISupported()
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
    binaries: options.binaries,
  }

  // creates a matrix of binaries x binary targets
  const binaryJobs = Object.entries(opts.binaries).flatMap(([binaryName, targetFolder]) =>
    opts.binaryTargets.map((binaryTarget) => {
      const fileName = getBinaryName(binaryName as BinaryType, binaryTarget)
      const targetFilePath = path.join(targetFolder, fileName)
      return {
        binaryName,
        targetFolder,
        binaryTarget,
        fileName,
        targetFilePath,
        envVarPath: getBinaryEnvVarPath(binaryName as BinaryType)?.path,
        skipCacheIntegrityCheck: !!opts.skipCacheIntegrityCheck,
      }
    }),
  )

  if (process.env.BINARY_DOWNLOAD_VERSION) {
    debug(`process.env.BINARY_DOWNLOAD_VERSION is set to "${process.env.BINARY_DOWNLOAD_VERSION}"`)
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

    const promises = binariesToDownload.map((job) => {
      const downloadUrl = getDownloadUrl({
        channel: 'all_commits',
        version: opts.version,
        platform: job.binaryTarget,
        binaryName: job.binaryName,
      })

      debug(`${downloadUrl} will be downloaded to ${job.targetFilePath}`)

      return downloadEngineAndSha256({
        ...job,
        downloadUrl,
        version: opts.version,
        failSilent: opts.failSilent,
        progressCb: setProgress ? setProgress(job.targetFilePath) : undefined,
      })
    })

    await Promise.all(promises)

    await cleanupPromise // make sure, that cleanup finished

    if (finishBar) {
      finishBar()
    }
  }

  const binaryPaths = binaryJobsToBinaryPaths(binaryJobs)
  const dir = eval('__dirname')

  // this is necessary for pkg
  if (dir.match(vercelPkgPathRegex)) {
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
  const targetExists = fs.existsSync(job.targetFilePath)
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
      debug(`skipCacheIntegrityCheck === true - ${cachedFile} will be copied to ${job.targetFilePath}`)
      await overwriteFile(cachedFile, job.targetFilePath)

      return false
    }

    const sha256FilePath = cachedFile + '.sha256'
    if (fs.existsSync(sha256FilePath)) {
      const sha256File = await fs.promises.readFile(sha256FilePath, 'utf-8')
      const sha256Cache = await getHash(cachedFile)
      if (sha256File === sha256Cache) {
        if (!targetExists) {
          debug(`sha256File === sha256Cache - ${cachedFile} will be copied to ${job.targetFilePath}`)

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
    } else if (process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING) {
      // If the env var is truthy we do not error if the checksum file is missing
      debug(
        `The checksum file: ${sha256FilePath} is missing but this was ignored as the PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING environment variable is truthy.`,
      )
      return false
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
    debug(`job.binaryTarget === nativePlatform - the checksum will be checked`)

    const engineSha256 = await getHash(job.targetFilePath)
    const { sha256_path_for_engine } = getSha256Paths(job.targetFilePath)

    let engineSha256FromSha256File = ''
    try {
      engineSha256FromSha256File = await fs.promises.readFile(sha256_path_for_engine, 'utf8')
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Download is needed, because the sha256 file does not exist
        debug(`The engineSha256FromSha256File does not exist, we need to execute the download logic for that engine.`)
      } else {
        // Download is needed, we can't read the sha256 file
        debug(
          `There was an error while trying to read ${sha256_path_for_engine} we will ignore it, we need to execute the download logic for that engine.`,
          e,
        )
      }
      return true
    }

    if (engineSha256 === engineSha256FromSha256File) {
      debug(
        `The engineSha256 (${engineSha256}) matches with the one contained in ${sha256_path_for_engine} The download logic will be skipped for that engine.`,
      )
    } else {
      debug(
        `The engineSha256 (${engineSha256}) does not match engineSha256FromSha256File (${engineSha256FromSha256File}), we need to execute the download logic for that engine.`,
      )
      return true
    }
  }

  return false
}

export function getBinaryName(binaryName: BinaryType, platform: Platform): string {
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

  if (fs.existsSync(cachedTargetPath)) {
    return cachedTargetPath
  }

  return null
}

type DownloadBinaryOptions = BinaryDownloadJob & {
  version: string
  downloadUrl: string
  progressCb?: (progress: number) => void
  failSilent?: boolean
}

async function downloadEngineAndSha256(options: DownloadBinaryOptions): Promise<void> {
  const { version, progressCb, targetFilePath, downloadUrl } = options

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

  debug(`We will download ${downloadUrl} then unpack it and copy it to ${targetFilePath} ...`)
  if (progressCb) {
    progressCb(0)
  }

  const downloadTempTarget = tempy.file()
  const { sha256, zippedSha256 } = await downloadZip({ url: downloadUrl, downloadTempTarget, progressCb })
  if (progressCb) {
    progressCb(1)
  }

  // Here we must call `overwriteFile` which will first delete and then copy
  // Copying in place (actually overwriting) errors in some case on Linux (and maybe others)
  // Example in our monorepo pnpm errors with
  // packages/engines postinstall: Failed
  // ELIFECYCLE Command failed with exit code 129.
  await overwriteFile(downloadTempTarget, targetFilePath)

  const { sha256_path_for_engine, sha256_path_for_gz } = getSha256Paths(targetFilePath)
  if (sha256 != null) {
    await fs.promises.writeFile(sha256_path_for_engine, sha256)
  }
  if (zippedSha256 != null) {
    await fs.promises.writeFile(sha256_path_for_gz, zippedSha256)
  }

  // await fs.promises.copyFile(downloadTempTarget, targetFilePath)

  // it's ok if the unlink fails
  try {
    await removeFileIfExists(downloadTempTarget)
  } catch (e) {
    debug('Error from removeFileIfExists', e)
  }

  debug(`Setting chmod +x permission (noop on Windows)`)
  chmodPlusX(targetFilePath)

  // Add files to local cache directory
  await saveFileToCache(options, version, sha256, zippedSha256)
}

async function saveFileToCache(
  job: BinaryDownloadJob,
  version: string,
  sha256: string | null,
  zippedSha256: string | null,
): Promise<void> {
  // always fail silent, as the cache is optional
  const cacheDir = await getCacheDir(channel, version, job.binaryTarget)
  if (!cacheDir) {
    debug(`The file will not be saved to the cache, as the cache directory ${cacheDir} doesn't exist`)
    return
  }

  const cachedTargetPath = path.join(cacheDir, job.binaryName)
  const { sha256_path_for_engine, sha256_path_for_gz } = getSha256Paths(path.join(cacheDir, job.binaryName))
  try {
    debug(`Saving files to the cache directory ${cacheDir} ...`)
    await overwriteFile(job.targetFilePath, cachedTargetPath)

    if (sha256 != null) {
      await fs.promises.writeFile(sha256_path_for_engine, sha256)
    }
    if (zippedSha256 != null) {
      await fs.promises.writeFile(sha256_path_for_gz, zippedSha256)
    }
  } catch (e) {
    debug('Something failed while saving files to the cache directory', e)
    // let this fail silently - the CI system may have reached the file size limit
  }
}

export async function maybeCopyToTmp(file: string): Promise<string> {
  // in this case, we are in a "pkg" context with a virtual fs
  // to make this work, we need to copy the binary to /tmp and execute it from there

  const dir = eval('__dirname')
  if (dir.match(vercelPkgPathRegex)) {
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

export function plusX(file: string): void {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) {
    return
  }
  const base8 = newMode.toString(8).slice(-3)
  fs.chmodSync(file, base8)
}
