import os from 'os'
import fs from 'fs'
import { promisify } from 'util'
import { exec } from 'child_process'
import Debug from 'debug'
import { Platform } from './platforms'
const debug = Debug('getos')

const readFile = promisify(fs.readFile)
const exists = promisify(fs.exists)

export type GetOSResult = {
  platform: NodeJS.Platform
  libssl?: string
  distro?: 'rhel' | 'debian'
}

export async function getos(): Promise<GetOSResult> {
  const platform = os.platform()
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

  const idMatch = input.match(idRegex)
  const id = (idMatch && idMatch[1] && idMatch[1].toLowerCase()) || ""

  const idLikeMatch = input.match(idLikeRegex)
  const idLike = (idLikeMatch && idLikeMatch[1] && idLikeMatch[1].toLowerCase()) || ""

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
  const osReleaseFile = '/etc/os-release'

  if (!(await exists(osReleaseFile))) {
    return
  }

  const file = await readFile(osReleaseFile, 'utf-8')

  return parseDistro(file)
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

  debug({ version })
  debug({ ls })

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
  return new Promise(resolve => {
    try {
      exec(cmd, (err, stdout, stderr) => {
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

  debug({ platform, libssl })

  if (platform === 'darwin') {
    return 'darwin'
  }

  if (platform === 'win32') {
    return 'windows'
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
    return (distro + 'debian-openssl-1.1.x') as Platform
  }

  // use the debian build with OpenSSL 1.1 as a last resort
  return 'debian-openssl-1.1.x'
}
