import os from 'os'
import fs from 'fs'
import { promisify } from 'util'
import { exec } from 'child_process'
import { Platform } from './platforms'

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export type GetOSResult = {
  platform: NodeJS.Platform
  libssl?: string
  distro?:
    | 'rhel'
    | 'debian'
    | 'musl'
    | 'arm'
    | 'nixos'
    | 'freebsd11'
    | 'freebsd12'
}

export async function getos(): Promise<GetOSResult> {
  const platform = os.platform()

  if (platform === 'freebsd') {
    const version = await gracefulExec(`freebsd-version`)
    if (version && version.trim().length > 0) {
      const regex = /^(\d+)\.?/
      const match = regex.exec(version)
      if (match) {
        return {
          platform: 'freebsd',
          distro: `freebsd${match[1]}` as GetOSResult['distro'],
        }
      }
    }
  }

  if (platform !== 'linux') {
    return {
      platform,
    }
  }

  return {
    platform: 'linux',
    libssl: await getOpenSSLVersion(),
    distro: await resolveDistro(),
  }
}

export function parseDistro(input: string): GetOSResult['distro'] {
  const idRegex = /^ID="?([^"\n]*)"?$/im
  const idLikeRegex = /^ID_LIKE="?([^"\n]*)"?$/im

  const idMatch = idRegex.exec(input)
  const id = (idMatch && idMatch[1] && idMatch[1].toLowerCase()) || ''

  const idLikeMatch = idLikeRegex.exec(input)
  const idLike =
    (idLikeMatch && idLikeMatch[1] && idLikeMatch[1].toLowerCase()) || ''

  if (id === 'raspbian') {
    return 'arm'
  }

  if (id === 'nixos') {
    return 'nixos'
  }

  if (
    idLike.includes('centos') ||
    idLike.includes('fedora') ||
    idLike.includes('rhel') ||
    id === 'fedora'
  ) {
    return 'rhel'
  }

  if (
    idLike.includes('debian') ||
    idLike.includes('ubuntu') ||
    id === 'debian'
  ) {
    return 'debian'
  }

  return
}

export async function resolveDistro(): Promise<
  undefined | GetOSResult['distro']
> {
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

// getOpenSSLVersion returns the OpenSSL version excluding the patch version, e.g. "1.1.x"
export async function getOpenSSLVersion(): Promise<string | undefined> {
  const [version, ls] = await Promise.all([
    gracefulExec(`openssl version -v`),
    gracefulExec(`
      ls -l /lib64 | grep ssl;
      ls -l /usr/lib64 | grep ssl;
    `),
  ])

  if (version) {
    const v = parseOpenSSLVersion(version)
    if (v) {
      return v
    }
  }

  if (ls) {
    const match = /libssl\.so\.(\d+\.\d+)\.\d+/.exec(ls)
    if (match) {
      return match[1] + '.x'
    }
  }

  return undefined
}

async function gracefulExec(cmd: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      exec(cmd, (err, stdout) => {
        resolve(String(stdout))
      })
    } catch (e) {
      resolve(undefined)
      return undefined
    }
  })
}

export async function getPlatform(): Promise<Platform> {
  const { platform, libssl, distro } = await getos()

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
  if (platform === 'linux' && distro === 'arm') {
    return `linux-arm-openssl-${libssl}` as Platform
  }

  if (platform === 'linux' && distro === 'nixos') {
    return 'linux-nixos'
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
  return 'debian-openssl-1.1.x'
}
