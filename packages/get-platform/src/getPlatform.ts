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
  distro?: {
    dist: string
    codename: string
    release: string
  }
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
    libssl: await getLibSslVersion(),
    distro: await resolveUbuntu(),
  }
}

export async function resolveUbuntu(): Promise<null | {
  dist: string
  release: string
  codename: string
}> {
  if (await exists('/etc/lsb-release')) {
    const idRegex = /distrib_id=(.*)/i
    const releaseRegex = /distrib_release=(.*)/i
    const codenameRegex = /distrib_codename=(.*)/i

    const file = await readFile('/etc/lsb-release', 'utf-8')

    const idMatch = file.match(idRegex)
    const id = (idMatch && idMatch[1]) || null

    const codenameMatch = file.match(codenameRegex)
    const codename = (codenameMatch && codenameMatch[1]) || null

    const releaseMatch = file.match(releaseRegex)
    const release = (releaseMatch && releaseMatch[1]) || null

    if (id && codename && release && id.toLowerCase() === 'ubuntu') {
      return { dist: id, release, codename }
    }
  }

  return null
}

export async function getLibSslVersion(): Promise<string | undefined> {
  const [version, ls] = await Promise.all([
    gracefulExec(`openssl version -v`),
    gracefulExec(`ls -l /lib64 | grep ssl;
    ls -l /usr/lib64 | grep ssl`),
  ])

  debug({ version })
  debug({ ls })

  if (version) {
    const match = /^OpenSSL\s(\d+\.\d+\.\d+)/.exec(version)
    if (match) {
      return match[1]
    }
  }

  if (ls) {
    const match = /libssl\.so\.(\d+\.\d+\.\d+)/.exec(ls)
    if (match) {
      return match[1]
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

  if (platform === 'linux' && libssl) {
    if (libssl === '1.0.2') {
      if (distro && distro.codename === 'xenial') {
        return 'linux-glibc-libssl1.0.2-ubuntu1604'
      }
      return 'linux-glibc-libssl1.0.2'
    }

    if (libssl === '1.0.1') {
      return 'linux-glibc-libssl1.0.1'
    }
  }

  return 'linux-glibc-libssl1.1.0'
}
