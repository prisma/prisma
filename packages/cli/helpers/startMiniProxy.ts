import { enginesVersion } from '@prisma/engines'
import { download, getCacheDir } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { $ } from 'zx'

export async function startMiniProxy() {
  const platform = await getPlatform()
  const cacheDir = (await getCacheDir('master', enginesVersion, platform))!
  const binaryEnginePath = `${cacheDir}/query-engine${platform === 'windows' ? '.exe' : ''}`

  if (existsSync(binaryEnginePath) === false) {
    await download({
      binaries: { 'query-engine': tmpdir() },
      version: enginesVersion,
    })
  }

  await miniProxy.generateCertificates(miniProxy.defaultCertificatesConfig)
  const process = $`pnpm mini-proxy server --query-engine ${binaryEnginePath}`.quiet()

  for await (const line of process.stdout) {
    if (line.includes('listening on port')) {
      break
    }
  }

  console.log('Started mini-proxy server')

  return {
    kill: () => {
      return process.kill()
    },
  }
}

void startMiniProxy()
