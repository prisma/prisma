import { Debug } from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import type { BinaryPaths, DownloadOptions } from '@prisma/fetch-engine'
import { BinaryType } from '@prisma/fetch-engine'
import type { BinaryTarget } from '@prisma/get-platform'
import path from 'path'

const debug = Debug('prisma:engines')
export function getEnginesPath() {
  return path.join(__dirname, '../')
}

type EnsureSomeBinariesExistInput = {
  hasMigrateAdapterInConfig: boolean
  download: (options: DownloadOptions) => Promise<BinaryPaths>
}

export async function ensureNeededBinariesExist({ download, hasMigrateAdapterInConfig }: EnsureSomeBinariesExistInput) {
  const binaryDir = path.join(__dirname, '../')

  const binaries = {} as Record<BinaryType, string>

  if (!hasMigrateAdapterInConfig) {
    binaries[BinaryType.SchemaEngineBinary] = binaryDir
  }

  debug(`binaries to download ${Object.keys(binaries).join(', ')}`)

  const binaryTargets = process.env.PRISMA_CLI_BINARY_TARGETS
    ? (process.env.PRISMA_CLI_BINARY_TARGETS.split(',') as BinaryTarget[])
    : undefined

  await download({
    binaries: binaries,
    showProgress: true,
    version: enginesVersion,
    failSilent: false,
    binaryTargets,
  })
}

export { enginesVersion } from '@prisma/engines-version'
