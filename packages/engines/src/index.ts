import { Debug } from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import type { BinaryPaths, DownloadOptions } from '@prisma/fetch-engine'
import { BinaryType } from '@prisma/fetch-engine'
import path from 'path'

const debug = Debug('prisma:engines')
export function getEnginesPath() {
  return path.join(__dirname, '../')
}
// Deprecated: Client engine no longer uses query engine binaries

type EnsureSomeBinariesExistInput = {
  clientEngineType: 'client'
  hasMigrateAdapterInConfig: boolean
  download: (options: DownloadOptions) => Promise<BinaryPaths>
}

export async function ensureNeededBinariesExist({
  clientEngineType: _clientEngineType,
  download,
  hasMigrateAdapterInConfig,
}: EnsureSomeBinariesExistInput) {
  const binaryDir = path.join(__dirname, '../')

  const binaries = {} as Record<BinaryType, string>

  if (!hasMigrateAdapterInConfig) {
    binaries[BinaryType.SchemaEngineBinary] = binaryDir
  }

  // Client engine no longer requires downloading query engine binaries

  debug(`binaries to download ${Object.keys(binaries).join(', ')}`)

  await download({
    binaries: binaries,
    showProgress: true,
    version: enginesVersion,
    failSilent: false,
  })
}

export { enginesVersion } from '@prisma/engines-version'
