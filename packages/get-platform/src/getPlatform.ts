import os from 'os'
import { exec } from 'child_process'
import Debug from 'debug'
import { Platform } from './platforms'
const debug = Debug('getos')

export type GetOSResult = {
  platform: NodeJS.Platform
  libssl?: string
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
  }
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
  const { platform, libssl } = await getos()

  if (platform === 'darwin') {
    return 'darwin'
  }

  debug({ platform, libssl })

  if (platform === 'linux' && libssl) {
    if (libssl === '1.0.2') {
      return 'linux-glibc-libssl1.0.2'
    }

    if (libssl === '1.0.1') {
      return 'linux-glibc-libssl1.0.1'
    }
  }

  return 'linux-glibc-libssl1.1.0'
}
