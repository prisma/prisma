import cp from 'child_process'
import fs from 'fs'
import os from 'os'
import { match } from 'ts-pattern'
import { promisify } from 'util'

import { Platform } from './platforms'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)
const exec = promisify(cp.exec)

// https://www.geeksforgeeks.org/node-js-process-arch-property/
export type Arch = 'x32' | 'x64' | 'arm' | 'arm64' | 's390' | 's390x' | 'mipsel' | 'ia32' | 'mips' | 'ppc' | 'ppc64'
export type GetOSResult = {
  platform: NodeJS.Platform
  libssl?: string
  arch: Arch
  distro?: 'rhel' | 'debian' | 'musl' | 'arm' | 'nixos' | 'freebsd11' | 'freebsd12' | 'freebsd13'
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

export function parseOpenSSLVersion(input: string): string | undefined {
  const match = /^OpenSSL\s(\d+\.\d+)\.\d+/.exec(input)
  if (match) {
    return match[1] + '.x'
  }

  return
}

type GetOpenSSLVersionParams = {
  arch: Arch
  distro: GetOSResult['distro']
}

/**
 * On Linux, returns the OpenSSL version excluding the patch version, e.g. "1.1.x".
 * Reading the version from the libssl.so file is more reliable than reading it from the openssl binary.
 * This function never throws.
 */
export async function getSSLVersion(args: GetOpenSSLVersionParams): Promise<string | undefined> {
  const libsslVersion: string | undefined = await match(args)
    .with({ distro: 'musl' }, () => {
      /* Linux Alpine */
      return getFirstSuccessfulExec(['ls -l /lib/libssl.so.3', 'ls -l /lib/libssl.so.1.1'])
    })
    .otherwise(() => {
      return getFirstSuccessfulExec(['ls -l /lib64 | grep ssl', 'ls -l /usr/lib64 | grep ssl'])
    })

  if (libsslVersion) {
    const match = /libssl\.so\.(\d+\.\d+)\.\d+/.exec(libsslVersion)
    if (match) {
      return match[1] + '.x'
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
    return 'linux-musl'
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
 * Given a list of system commands, returns the first successful command's stdout.
 * This function never throws.
 */
function getFirstSuccessfulExec(commands: string[]) {
  return discardError(async () => {
    const results = await Promise.allSettled(commands.map((cmd) => exec(cmd)))
    const { value } = results.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<{
      stdout: string | Buffer
    }>
    return String(value.stdout)
  })
}
