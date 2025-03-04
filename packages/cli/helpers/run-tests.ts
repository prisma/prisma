import { enginesVersion } from '@prisma/engines'
import { download, getCacheDir } from '@prisma/fetch-engine'
import { getBinaryTargetForCurrentPlatform } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import execa from 'execa'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

/**
 * Generates a certificate for the Mini Proxy and prints its CA path to stdout.
 * This is used to configure Node.js so it trusts the Mini proxy certificate.
 */
export async function main() {
  let miniProxyProcess: Awaited<ReturnType<typeof startMiniProxy>> | undefined

  if (process.platform !== 'win32') {
    if (existsSync(miniProxy.defaultCertificatesConfig.caCert) === false) {
      await miniProxy.generateCertificates(miniProxy.defaultCertificatesConfig)
    }

    miniProxyProcess = await startMiniProxy()

    process.env.NODE_EXTRA_CA_CERTS = miniProxy.defaultCertificatesConfig.caCert
  }

  execa.sync('jest', ['--silent', ...process.argv.slice(2)], {
    preferLocal: true,
    stdio: 'inherit',
    env: process.env,
  })

  miniProxyProcess?.kill()
}

/**
 * Starts the Mini Proxy in a background process and returns a "kill" handle.
 * @returns an object to kill the process
 */
export async function startMiniProxy() {
  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  const cacheDir = (await getCacheDir('master', enginesVersion, binaryTarget))!
  const qePath = `${cacheDir}/query-engine${binaryTarget === 'windows' ? '.exe' : ''}`

  if (existsSync(qePath) === false) {
    await download({
      // we download it anywhere as it gets copied to the cache dir anyway
      binaries: { 'query-engine': tmpdir() },
      version: enginesVersion,
    })
  }

  const process = execa('mini-proxy', ['server', '-q', qePath], {
    preferLocal: true,
    stdio: 'ignore',
  })

  return {
    kill: () => {
      process.kill()
    },
  }
}

void main()
