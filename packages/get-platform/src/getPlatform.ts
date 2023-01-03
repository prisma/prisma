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
 * On Linux, returns the OpenSSL version excluding the patch version, e.g. "1.1.x".
 * Reading the version from the libssl.so file is more reliable than reading it from the openssl binary.
 * This function never throws.
 *
 * TODO: we should probably validate the output of this function, and ensure it's contained in `supportedLibSSLVersions`
 */
export async function getSSLVersion(args: GetOpenSSLVersionParams): Promise<GetOSResult['libssl'] | undefined> {
  const libsslSpecificPaths = await match(args)
    .with({ distro: 'musl' }, async () => {
      /* Linux Alpine */
      debug('Trying platform-specific paths for "alpine"')
      return Promise.resolve(['/lib'])
    })
    .with({ distro: 'debian' }, async () => {
      /* Linux Debian, Ubuntu, etc */
      const archFromUname = await getArchFromUname()
      debug('Trying platform-specific paths for "debian" (and "ubuntu")')
      return [`/usr/lib/${archFromUname}-linux-gnu`, `/lib/${archFromUname}-linux-gnu`]
    })
    .otherwise(({ distro, arch }) => {
      /* Other Linux distros, we don't do anything specific and fall back to the next blocks */
      debug(`Don't know any platform-specific paths for "${distro}" on ${arch}`)
      return Promise.resolve(undefined)
    })

  const libsslSpecificCommands = (libsslSpecificPaths || []).map((path) => `ls -r ${path} | grep libssl.so`)
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
    'ldconfig -p | sed "s/.*=>s*//" | sed "s/.*///" | grep ssl | sort -r',
    'ls -r /lib64 | grep ssl',
    'ls -r /usr/lib64 | grep ssl',
  ])

  if (libsslFilename) {
    debug(`Found libssl.so file using "ldconfig" and other generic paths: ${libsslFilenameFromSpecificPath}`)
    const libsslVersion = parseLibSSLVersion(libsslFilename)
    if (libsslVersion) {
      return libsslVersion
    }
  }

  /* Reading the libssl.so version didn't work, fall back to openssl */

  const openSSLVersionLine: string | undefined = await getFirstSuccessfulExec(['openssl version -v'])

  if (openSSLVersionLine) {
    debug(`Found openssl binary with version: ${openSSLVersionLine}`)
    const openSSLVersion = parseOpenSSLVersion(openSSLVersionLine)
    debug(`The parsed openssl version is: ${openSSLVersion}`)
    if (openSSLVersion) {
      return openSSLVersion
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
