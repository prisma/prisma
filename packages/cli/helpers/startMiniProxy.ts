import { enginesVersion } from '@prisma/engines'
import { download, getCacheDir } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/internals'
import execa from 'execa'
import { existsSync } from 'fs'
import { tmpdir } from 'os'

/**
 * Starts the Mini Proxy in a background process and returns a "kill" handle.
 * @returns an object to kill the process
 */
export async function startMiniProxy() {
  const platform = await getPlatform()
  const cacheDir = (await getCacheDir('master', enginesVersion, platform))!
  const qePath = `${cacheDir}/query-engine${platform === 'windows' ? '.exe' : ''}`

  if (existsSync(qePath) === false) {
    await download({
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
