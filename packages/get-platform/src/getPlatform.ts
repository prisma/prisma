import Debug from '@prisma/debug'
import cp from 'child_process'
import fs from 'fs'
import os from 'os'
import { match } from 'ts-pattern'
import { promisify } from 'util'

import { Platform } from './platforms'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)
const exec = promisify(cp.exec)

const debug = Debug('prisma:get-platform')

const supportedLibSSLVersions = ['1.0.x', '1.1.x', '3.0.x'] as const

// https://www.geeksforgeeks.org/node-js-process-arch-property/
export type Arch = 'x32' | 'x64' | 'arm' | 'arm64' | 's390' | 's390x' | 'mipsel' | 'ia32' | 'mips' | 'ppc' | 'ppc64'
export type GetOSResult = {
  platform: NodeJS.Platform
  arch: Arch
  distro?: 'rhel' | 'debian' | 'musl' | 'arm' | 'nixos' | 'freebsd11' | 'freebsd12' | 'freebsd13'

  /**
   * Starting from version 3.0, OpenSSL is basically adopting semver, and will be API and ABI compatible within a major version.
   */
  libssl?: typeof supportedLibSSLVersions[number]
}

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
          distro: `freebsd${match[1]}` as GetOSResult['distro'],
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

  const distro = await resolveDistro()

  return {
    platform: 'linux',
    libssl: await getSSLVersion({ arch, distro }),
    distro,
    arch,
  }
}

export function parseDistro(input: string): GetOSResult['distro'] {
  const idRegex = /^ID="?([^"\n]*)"?$/im
  const idLikeRegex = /^ID_LIKE="?([^"\n]*)"?$/im

  const idMatch = idRegex.exec(input)
  const id = (idMatch && idMatch[1] && idMatch[1].toLowerCase()) || ''

  const idLikeMatch = idLikeRegex.exec(input)
  const idLike = (idLikeMatch && idLikeMatch[1] && idLikeMatch[1].toLowerCase()) || ''

  if (id === 'raspbian') {
    return 'arm'
  }

  if (id === 'nixos') {
    return 'nixos'
  }

  if (idLike.includes('centos') || idLike.includes('fedora') || idLike.includes('rhel') || id === 'fedora') {
    return 'rhel'
  }

  if (idLike.includes('debian') || idLike.includes('ubuntu') || id === 'debian') {
    return 'debian'
  }

  return
}

export async function resolveDistro(): Promise<undefined | GetOSResult['distro']> {
  // https://github.com/retrohacker/getos/blob/master/os.json
  const osReleaseFile = '/etc/os-release'
  const alpineReleaseFile = '/etc/alpine-release'

  if (await exists(alpineReleaseFile)) {
    return 'musl'
  } else if (await exists(osReleaseFile)) {
    return parseDistro(await readFile(osReleaseFile, 'utf-8'))
  } else {
    return
  }
}

/**
 * Parse the OpenSSL version from the output of the openssl binary, e.g.
 * "OpenSSL 3.0.2 15 Mar 2022 (Library: OpenSSL 3.0.2 15 Mar 2022)" -> "3.0.x"
 */
export function parseOpenSSLVersion(input: string): GetOSResult['libssl'] | undefined {
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
export function parseLibSSLVersion(input: string): GetOSResult['libssl'] | undefined {
  const match = /libssl\.so\.(\d)(\.\d)?/.exec(input)
  if (match) {
    const partialVersion = `${match[1]}${match[2] ?? '.0'}.x`
    return sanitiseSSLVersion(partialVersion)
  }

  return undefined
}

function sanitiseSSLVersion(version: string): NonNullable<GetOSResult['libssl']> {
  if (isLibssl1x(version)) {
    return version
  }

  /**
   * Sanitise OpenSSL 3+. E.g., '3.1.x' becomes '3.0.x'
   */
  const versionSplit = version.split('.')
  versionSplit[1] = '0'
  return versionSplit.join('.') as NonNullable<GetOSResult['libssl']>
}

type GetOpenSSLVersionParams = {
  arch: Arch
  distro: GetOSResult['distro']
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
export async function getSSLVersion(args: GetOpenSSLVersionParams): Promise<GetOSResult['libssl'] | undefined> {
  const archFromUname = await getArchFromUname()

  const libsslSpecificPaths = match(args)
    .with({ distro: 'musl' }, () => {
      /* Linux Alpine */
      debug('Trying platform-specific paths for "alpine"')
      return ['/lib']
    })
    .with({ distro: 'debian' }, () => {
      /* Linux Debian, Ubuntu, etc */
      debug('Trying platform-specific paths for "debian" (and "ubuntu")')
      return [`/usr/lib/${archFromUname}-linux-gnu`, `/lib/${archFromUname}-linux-gnu`]
    })
    .with({ distro: 'rhel' }, () => {
      /* Linux Red Hat, OpenSuse etc */
      debug('Trying platform-specific paths for "rhel"')
      return ['/lib64', '/usr/lib64']
    })
    .otherwise(({ distro, arch }) => {
      /* Other Linux distros, we don't do anything specific and fall back to the next blocks */
      debug(`Don't know any platform-specific paths for "${distro}" on ${arch}`)
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
    'ldconfig -p | sed "s/.*=>s*//" | sed "s|.*/||" | grep ssl | sort',

    /**
     * Fall back to the rhel-specific paths (although "distro" isn't detected as rhel) when the "ldconfig" command fails.
     */
    'ls /lib64 | grep ssl',
    'ls /usr/lib64 | grep ssl',
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
  const { platform, libssl, distro, arch } = await getos()

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
    return distro as Platform
  }

  if (platform === 'openbsd') {
    return 'openbsd'
  }

  if (platform === 'netbsd') {
    return 'netbsd'
  }

  if (platform === 'linux' && distro === 'nixos') {
    return 'linux-nixos'
  }

  if (platform === 'linux' && arch === 'arm64') {
    // 64 bit ARM
    return `linux-arm64-openssl-${libssl}` as Platform
  }

  if (platform === 'linux' && arch === 'arm') {
    // 32 bit ARM
    return `linux-arm-openssl-${libssl}` as Platform
  }

  if (platform === 'linux' && distro === 'musl') {
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
  if (platform === 'linux' && distro && libssl) {
    return (distro + '-openssl-' + libssl) as Platform
  }

  // if just OpenSSL is known, fallback to debian with a specific libssl version
  if (libssl) {
    return ('debian-openssl-' + libssl) as Platform
  }

  // if just the distro is known, fallback to latest OpenSSL 1.1
  if (distro) {
    return (distro + '-openssl-1.1.x') as Platform
  }

  // use the debian build with OpenSSL 1.1 as a last resort
  // TODO: perhaps we should default to 'debian-openssl-3.0.x'
  return 'debian-openssl-1.1.x'
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
 */
async function getArchFromUname(): Promise<string | undefined> {
  const arch = await getFirstSuccessfulExec(['uname -m'])
  return arch?.trim()
}

function isLibssl1x(libssl: NonNullable<GetOSResult['libssl']> | string): libssl is '1.0.x' | '1.1.x' {
  return libssl.startsWith('1.')
}
