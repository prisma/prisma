import Debug from '@prisma/debug'
import cp from 'child_process'
import fs from 'fs'
import os from 'os'
import { match } from 'ts-pattern'
import { promisify } from 'util'

import { link } from './link'
import { warn } from './logger'
import { Platform } from './platforms'

const readFile = promisify(fs.readFile)
const exec = promisify(cp.exec)

const debug = Debug('prisma:get-platform')

const supportedLibSSLVersions = ['1.0.x', '1.1.x', '3.0.x'] as const

// https://www.geeksforgeeks.org/node-js-process-arch-property/
export type Arch = 'x32' | 'x64' | 'arm' | 'arm64' | 's390' | 's390x' | 'mipsel' | 'ia32' | 'mips' | 'ppc' | 'ppc64'
export type DistroInfo = {
  /**
   * The original distro is the Linux distro name detected via its release file.
   * E.g., on Arch Linux, the original distro is `arch`. On Linux Alpine, the original distro is `alpine`.
   */
  originalDistro?: string

  /**
   * The family distro is the Linux distro name that is used to determine Linux flavors based on the same base distro, and likely using the same package manager.
   * E.g., both Ubuntu and Debian belong to the `debian` family of distros, and thus rely on the same package manager (`apt`).
   */
  familyDistro?: string

  /**
   * The target distro is the Linux distro associated with the Prisma Engines.
   * E.g., on Arch Linux, Debian, and Ubuntu, the target distro is `debian`. On Linux Alpine, the target distro is `musl`.
   */
  targetDistro?: 'rhel' | 'debian' | 'musl' | 'arm' | 'nixos' | 'freebsd11' | 'freebsd12' | 'freebsd13'
}
type GetOsResultLinux = {
  platform: 'linux'
  arch: Arch
  archFromUname: string | undefined
  /**
   * Starting from version 3.0, OpenSSL is basically adopting semver, and will be API and ABI compatible within a major version.
   */
  libssl?: typeof supportedLibSSLVersions[number]
} & DistroInfo

export type GetOSResult =
  | {
      platform: Omit<NodeJS.Platform, 'linux'>
      arch: Arch
      targetDistro?: DistroInfo['targetDistro']
      familyDistro?: never
      originalDistro?: never
      archFromUname?: never
      libssl?: never
    }
  | GetOsResultLinux

export async function getos(): Promise<GetOSResult> {
  const platform = os.platform()
  const arch = process.arch as Arch
  if (platform === 'freebsd') {
    const version = await getFirstSuccessfulExec([`freebsd-version`])
    if (version && version.trim().length > 0) {
      const regex = /^(\d+)\.?/
      const match = regex.exec(version)
      if (match) {
        return {
          platform: 'freebsd',
          targetDistro: `freebsd${match[1]}` as GetOSResult['targetDistro'],
          arch,
        }
      }
    }
  }

  if (platform !== 'linux') {
    return {
      platform,
      arch,
    }
  }

  const distroInfo = await resolveDistro()
  const archFromUname = await getArchFromUname()

  const libssl = await getSSLVersion({ arch, archFromUname, targetDistro: distroInfo.targetDistro })

  return {
    platform: 'linux',
    libssl,
    arch,
    archFromUname,
    ...distroInfo,
  }
}

export function parseDistro(osReleaseInput: string): DistroInfo {
  const idRegex = /^ID="?([^"\n]*)"?$/im
  const idLikeRegex = /^ID_LIKE="?([^"\n]*)"?$/im

  const idMatch = idRegex.exec(osReleaseInput)
  const id = (idMatch && idMatch[1] && idMatch[1].toLowerCase()) || ''

  const idLikeMatch = idLikeRegex.exec(osReleaseInput)
  const idLike = (idLikeMatch && idLikeMatch[1] && idLikeMatch[1].toLowerCase()) || ''

  /**
   * Example output of /etc/os-release:
   *
   * Alpine Linux => ID=alpine                                     => targetDistro=musl, familyDistro=alpine
   * Raspbian     => ID=raspbian, ID_LIKE=debian                   => targetDistro=arm, familyDistro=debian
   * Debian       => ID=debian                                     => targetDistro=debian, familyDistro=debian
   * Distroless   => ID=debian                                     => targetDistro=debian, familyDistro=debian
   * Ubuntu       => ID=ubuntu, ID_LIKE=debian                     => targetDistro=debian, familyDistro=debian
   * Arch Linux   => ID=arch                                       => targetDistro=debian, familyDistro=arch
   * Manjaro      => ID=manjaro, ID_LIKE=arch                      => targetDistro=debian, familyDistro=arch
   * Red Hat      => ID=rhel, ID_LIKE=fedora                       => targetDistro=rhel, familyDistro=rhel
   * Centos       => ID=centos, ID_LIKE=rhel fedora                => targetDistro=rhel, familyDistro=rhel
   * Alma Linux   => ID="almalinux", ID_LIKE="rhel centos fedora"  => targetDistro=rhel, familyDistro=rhel
   * Fedora       => ID=fedora                                     => targetDistro=rhel, familyDistro=rhel
   */
  const distroInfo = match({ id, idLike })
    .with(
      { id: 'alpine' },
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'musl',
          familyDistro: originalDistro,
          originalDistro,
        } as const),
    )
    .with(
      { id: 'raspbian' },
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'arm',
          familyDistro: 'debian',
          originalDistro,
        } as const),
    )
    .with(
      { id: 'nixos' },
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'nixos',
          originalDistro,
          familyDistro: 'nixos',
        } as const),
    )
    .with(
      { id: 'debian' },
      { id: 'ubuntu' },
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'debian',
          familyDistro: 'debian',
          originalDistro,
        } as const),
    )
    .with(
      { id: 'rhel' },
      { id: 'centos' },
      { id: 'fedora' },
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'rhel',
          familyDistro: 'rhel',
          originalDistro,
        } as const),
    )
    .when(
      ({ idLike }) => idLike.includes('debian') || idLike.includes('ubuntu'),
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'debian',
          familyDistro: 'debian',
          originalDistro,
        } as const),
    )
    .when(
      ({ idLike }) => id === 'arch' || idLike.includes('arch'),
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'debian',
          familyDistro: 'arch',
          originalDistro,
        } as const),
    )
    .when(
      ({ idLike }) => idLike.includes('centos') || idLike.includes('fedora') || idLike.includes('rhel'),
      ({ id: originalDistro }) =>
        ({
          targetDistro: 'rhel',
          familyDistro: 'rhel',
          originalDistro,
        } as const),
    )
    .otherwise(({ id: originalDistro }) => {
      /* Generic distro info fallback */
      return {
        targetDistro: undefined,
        familyDistro: undefined,
        originalDistro,
      } as const
    })

  debug(`Found distro info:\n${JSON.stringify(distroInfo, null, 2)}`)
  return distroInfo
}

export async function resolveDistro(): Promise<DistroInfo> {
  // https://github.com/retrohacker/getos/blob/master/os.json

  const osReleaseFile = '/etc/os-release'
  try {
    const osReleaseInput = await readFile(osReleaseFile, { encoding: 'utf-8' })
    return parseDistro(osReleaseInput)
  } catch (_) {
    return {
      targetDistro: undefined,
      familyDistro: undefined,
      originalDistro: undefined,
    }
  }
}

/**
 * Parse the OpenSSL version from the output of the openssl binary, e.g.
 * "OpenSSL 3.0.2 15 Mar 2022 (Library: OpenSSL 3.0.2 15 Mar 2022)" -> "3.0.x"
 */
export function parseOpenSSLVersion(input: string): GetOsResultLinux['libssl'] | undefined {
  const match = /^OpenSSL\s(\d+\.\d+)\.\d+/.exec(input)
  if (match) {
    const partialVersion = `${match[1]}.x`
    return sanitiseSSLVersion(partialVersion)
  }

  return undefined
}

/**
 * Parse the OpenSSL version from the output of the libssl.so file, e.g.
 * "libssl.so.3" -> "3.0.x"
 */
export function parseLibSSLVersion(input: string): GetOsResultLinux['libssl'] | undefined {
  const match = /libssl\.so\.(\d)(\.\d)?/.exec(input)
  if (match) {
    const partialVersion = `${match[1]}${match[2] ?? '.0'}.x`
    return sanitiseSSLVersion(partialVersion)
  }

  return undefined
}

function sanitiseSSLVersion(version: string): NonNullable<GetOsResultLinux['libssl']> {
  if (isLibssl1x(version)) {
    return version
  }

  /**
   * Sanitise OpenSSL 3+. E.g., '3.1.x' becomes '3.0.x'
   */
  const versionSplit = version.split('.')
  versionSplit[1] = '0'
  return versionSplit.join('.') as NonNullable<GetOsResultLinux['libssl']>
}

type GetOpenSSLVersionParams = {
  arch: Arch
  archFromUname: Awaited<ReturnType<typeof getArchFromUname>>
  targetDistro: DistroInfo['targetDistro']
}

/**
 * On Linux, returns the libssl version excluding the patch version, e.g. "1.1.x".
 * Reading the version from the libssl.so file is more reliable than reading it from the openssl binary.
 * Older versions of libssl are preferred, e.g. "1.0.x" over "1.1.x", because of Vercel serverless
 * having different build and runtime environments, with the runtime environment having an old version
 * of libssl, and the build environment having both that old version and a newer version of libssl installed.
 *
 * This function never throws.
 */
export async function getSSLVersion(args: GetOpenSSLVersionParams): Promise<GetOsResultLinux['libssl'] | undefined> {
  const libsslSpecificPaths = match(args)
    .with({ targetDistro: 'musl' }, () => {
      /* Linux Alpine */
      debug('Trying platform-specific paths for "alpine"')
      return ['/lib']
    })
    .with({ targetDistro: 'debian' }, ({ archFromUname }) => {
      /* Linux Debian, Ubuntu, etc */
      debug('Trying platform-specific paths for "debian" (and "ubuntu")')
      return [`/usr/lib/${archFromUname}-linux-gnu`, `/lib/${archFromUname}-linux-gnu`]
    })
    .with({ targetDistro: 'rhel' }, () => {
      /* Linux Red Hat, OpenSuse etc */
      debug('Trying platform-specific paths for "rhel"')
      return ['/lib64', '/usr/lib64']
    })
    .otherwise(({ targetDistro, arch, archFromUname }) => {
      /* Other Linux distros, we don't do anything specific and fall back to the next blocks */
      debug(`Don't know any platform-specific paths for "${targetDistro}" on ${arch} (${archFromUname})`)
      return []
    })

  const libsslSpecificCommands = libsslSpecificPaths.map((path) => `ls ${path} | grep libssl.so`)
  const libsslFilenameFromSpecificPath: string | undefined = await getFirstSuccessfulExec(libsslSpecificCommands)

  if (libsslFilenameFromSpecificPath) {
    debug(`Found libssl.so file using platform-specific paths: ${libsslFilenameFromSpecificPath}`)
    const libsslVersion = parseLibSSLVersion(libsslFilenameFromSpecificPath)
    debug(`The parsed libssl version is: ${libsslVersion}`)
    if (libsslVersion) {
      return libsslVersion
    }
  }

  debug('Falling back to "ldconfig" and other generic paths')
  const libsslFilename: string | undefined = await getFirstSuccessfulExec([
    /**
     * The `ldconfig -p` returns the dynamic linker cache paths, where libssl.so files are likely to be included.
     * Each line looks like this:
     * 	libssl.so (libc6,hard-float) => /usr/lib/arm-linux-gnueabihf/libssl.so.1.1
     * But we're only interested in the filename, so we use sed to remove everything before the `=>` separator,
     * and then we remove the path and keep only the filename.
     * The second sed commands uses `|` as a separator because the paths may contain `/`, which would result in the
     * `unknown option to 's'` error (see https://stackoverflow.com/a/9366940/6174476) - which would silently
     * fail with error code 0.
     */
    'ldconfig -p | sed "s/.*=>s*//" | sed "s|.*/||" | grep libssl | sort',

    /**
     * Fall back to the rhel-specific paths (although "targetDistro" isn't detected as rhel) when the "ldconfig" command fails.
     */
    'ls /lib64 | grep libssl',
    'ls /usr/lib64 | grep libssl',
  ])

  if (libsslFilename) {
    debug(`Found libssl.so file using "ldconfig" or other generic paths: ${libsslFilenameFromSpecificPath}`)
    const libsslVersion = parseLibSSLVersion(libsslFilename)
    if (libsslVersion) {
      return libsslVersion
    }
  }

  const openSSLVersionLine: string | undefined = await getFirstSuccessfulExec(['openssl version -v'])

  if (openSSLVersionLine) {
    debug(`Found openssl binary with version: ${openSSLVersionLine}`)
    const openSSLVersion = parseOpenSSLVersion(openSSLVersionLine)
    debug(`The parsed openssl version is: ${openSSLVersion}`)
    if (openSSLVersion) {
      return openSSLVersion
    }
  }

  /* Reading the libssl.so version didn't work, fall back to openssl */

  const openSSLVersion: string | undefined = await getFirstSuccessfulExec(['openssl version -v'])

  if (openSSLVersion) {
    const matchedVersion = parseOpenSSLVersion(openSSLVersion)
    if (matchedVersion) {
      return matchedVersion
    }
  }

  /* Reading openssl didn't work */
  debug(`Couldn't find any version of libssl or OpenSSL in the system`)
  return undefined
}

export async function getPlatform(): Promise<Platform> {
  const { platform } = await getPlatformMemoized()
  return platform
}

let memoizedPlatform: Platform | undefined

export async function getPlatformMemoized(): Promise<{ platform: Platform; memoized: boolean }> {
  if (memoizedPlatform) {
    return Promise.resolve({ platform: memoizedPlatform, memoized: true })
  }

  const args = await getos()
  memoizedPlatform = getPlatformInternal(args)
  return { platform: memoizedPlatform, memoized: false }
}

/**
 * This function is only exported for testing purposes.
 */
export function getPlatformInternal(args: GetOSResult): Platform {
  const { platform, arch, archFromUname, libssl, targetDistro, familyDistro, originalDistro } = args

  if (platform === 'linux' && !['x64', 'arm64'].includes(arch)) {
    warn(
      `Prisma only officially supports Linux on amd64 (x86_64) and arm64 (aarch64) system architectures. If you are using your own custom Prisma engines, you can ignore this warning, as long as you've compiled the engines for your system architecture "${archFromUname}".`,
    )
  }

  // sometimes we fail to detect the libssl version to use, so we default to 1.1.x
  const defaultLibssl = '1.1.x' as const
  if (platform === 'linux' && libssl === undefined) {
    /**
     * Ask the user to install libssl manually, and provide some additional instructions based on the detected Linux distro family.
     * TODO: we should also provide a pris.ly link to a documentation page with more details on how to install libssl.
     */
    const additionalMessage = match({ familyDistro })
      .with({ familyDistro: 'debian' }, () => {
        return "Please manually install OpenSSL via `apt-get update -y && apt-get install -y openssl` and try installing Prisma again. If you're running Prisma on Docker, you may also try to replace your base image with `node:lts-slim`, which already ships with OpenSSL installed."
      })
      .otherwise(() => {
        return 'Please manually install OpenSSL and try installing Prisma again.'
      })

    warn(
      `Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-${defaultLibssl}".
${additionalMessage}`,
    )
  }

  // sometimes we fail to detect the distro in use, so we default to debian
  const defaultDistro = 'debian' as const
  if (platform === 'linux' && targetDistro === undefined) {
    warn(
      `Prisma doesn't know which engines to download for the Linux distro "${originalDistro}". Falling back to Prisma engines built "${defaultDistro}".
Please report your experience by creating an issue at ${link(
        'https://github.com/prisma/prisma/issues',
      )} so we can add your distro to the list of known supported distros.`,
    )
  }

  // Apple Silicon (M1)
  if (platform === 'darwin' && arch === 'arm64') {
    return 'darwin-arm64'
  }

  if (platform === 'darwin') {
    return 'darwin'
  }

  if (platform === 'win32') {
    return 'windows'
  }

  if (platform === 'freebsd') {
    return targetDistro as Platform
  }

  if (platform === 'openbsd') {
    return 'openbsd'
  }

  if (platform === 'netbsd') {
    return 'netbsd'
  }

  if (platform === 'linux' && targetDistro === 'nixos') {
    return 'linux-nixos'
  }

  if (platform === 'linux' && arch === 'arm64') {
    // 64 bit ARM (musl or glibc)
    const baseName = targetDistro === 'musl' ? 'linux-musl-arm64' : 'linux-arm64'
    return `${baseName}-openssl-${libssl || defaultLibssl}` as Platform
  }

  if (platform === 'linux' && arch === 'arm') {
    // 32 bit ARM
    return `linux-arm-openssl-${libssl || defaultLibssl}` as Platform
  }

  if (platform === 'linux' && targetDistro === 'musl') {
    const base = 'linux-musl'
    if (!libssl) {
      return base
    }

    if (isLibssl1x(libssl)) {
      // Alpine 3.16 or below linked with OpenSSL 1.1
      return base
    } else {
      // Alpine 3.17 or above linked with OpenSSL 3.0
      return `${base}-openssl-${libssl}`
    }
  }

  // when the platform is linux
  if (platform === 'linux' && targetDistro && libssl) {
    return `${targetDistro}-openssl-${libssl}` as Platform
  }

  if (platform !== 'linux') {
    warn(`Prisma detected unknown OS "${platform}" and may not work as expected. Defaulting to "linux".`)
  }

  // if just OpenSSL is known, fallback to debian with a specific libssl version
  if (libssl) {
    return `${defaultDistro}-openssl-${libssl}`
  }

  // if just the targetDistro is known, fallback to latest OpenSSL 1.1
  if (targetDistro) {
    return `${targetDistro}-openssl-${defaultLibssl}` as Platform
  }

  // use the debian build with OpenSSL 1.1 as a last resort
  // TODO: perhaps we should default to 'debian-openssl-3.0.x'
  return `${defaultDistro}-openssl-${defaultLibssl}`
}

/**
 * Given a promise generator, returns the promise's result.
 * If the promise throws, returns undefined.
 */
async function discardError<T>(runPromise: () => Promise<T>): Promise<T | undefined> {
  try {
    return await runPromise()
  } catch (e) {
    return undefined
  }
}

/**
 * Given a list of system commands, runs them until they all resolve or reject, and returns the result of the first successful command
 * in the order of the input list.
 * This function never throws.
 */
function getFirstSuccessfulExec(commands: string[]) {
  return discardError(async () => {
    const results = await Promise.allSettled(commands.map((cmd) => exec(cmd)))
    const idx = results.findIndex(({ status }) => status === 'fulfilled')
    if (idx === -1) {
      return undefined
    }

    const { value } = results[idx] as PromiseFulfilledResult<{ stdout: string | Buffer }>
    const output = String(value.stdout)

    debug(`Command "${commands[idx]}" successfully returned "${output}"`)
    return output
  })
}

/**
 * Returns the architecture of a system from the output of `uname -m` (whose format is different than `process.arch`).
 * This function never throws.
 * TODO: deprecate this function in favor of `os.machine()` once either Node v16.18.0 or v18.9.0 becomes the minimum
 * supported Node.js version for Prisma.
 */
async function getArchFromUname(): Promise<string | undefined> {
  const arch = await getFirstSuccessfulExec(['uname -m'])
  return arch?.trim()
}

function isLibssl1x(libssl: NonNullable<GetOSResult['libssl']> | string): libssl is '1.0.x' | '1.1.x' {
  return libssl.startsWith('1.')
}
