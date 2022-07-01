import { enginesVersion } from '@prisma/engines'
import type { EngineDownloadConfiguration, DownloadOptions } from '@prisma/fetch-engine'
import { download } from '@prisma/fetch-engine'
import type { EnginePaths, BinaryTargetsEnvValue } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import makeDir from 'make-dir'
import path from 'path'

import { mapKeys } from '../../utils/mapKeys'
import type { GetBinaryPathsByVersionInput } from '../getGenerators'
import { binaryTypeToEngineType } from '../utils/binaryTypeToEngineType'
import { engineTypeToBinaryType } from '../utils/engineTypeToBinaryType'

export async function getBinaryPathsByVersion({
  neededVersions,
  platform,
  version,
  printDownloadProgress,
  skipDownload,
  binaryPathsOverride,
}: GetBinaryPathsByVersionInput): Promise<Record<string, EnginePaths>> {
  const binaryPathsByVersion: Record<string, EnginePaths> = Object.create(null)

  // make sure, that at least the current platform is being fetched
  for (const currentVersion in neededVersions) {
    binaryPathsByVersion[currentVersion] = {}

    // ensure binaryTargets are set correctly
    const neededVersion = neededVersions[currentVersion]

    if (neededVersion.binaryTargets.length === 0) {
      neededVersion.binaryTargets = [{ fromEnvVar: null, value: platform }]
    }

    if (process.env.NETLIFY && !neededVersion.binaryTargets.find((object) => object.value === 'rhel-openssl-1.0.x')) {
      neededVersion.binaryTargets.push({
        fromEnvVar: null,
        value: 'rhel-openssl-1.0.x',
      })
    }

    // download
    let binaryTargetBaseDir = eval(`require('path').join(__dirname, '..')`)

    if (version !== currentVersion) {
      binaryTargetBaseDir = path.join(binaryTargetBaseDir, `./engines/${currentVersion}/`)
      await makeDir(binaryTargetBaseDir).catch((e) => console.error(e))
    }

    const binariesConfig: EngineDownloadConfiguration = neededVersion.engines.reduce((acc, curr) => {
      // only download the binary, of not already covered by the `binaryPathsOverride`
      if (!binaryPathsOverride?.[curr]) {
        acc[engineTypeToBinaryType(curr)] = binaryTargetBaseDir
      }
      return acc
    }, Object.create(null))

    if (Object.values(binariesConfig).length > 0) {
      // Convert BinaryTargetsEnvValue[] to Platform[]
      const platforms: Platform[] = neededVersion.binaryTargets.map(
        (binaryTarget: BinaryTargetsEnvValue) => binaryTarget.value as Platform,
      )

      const downloadParams: DownloadOptions = {
        binaries: binariesConfig,
        binaryTargets: platforms,
        showProgress: typeof printDownloadProgress === 'boolean' ? printDownloadProgress : true,
        version: currentVersion && currentVersion !== 'latest' ? currentVersion : enginesVersion,
        skipDownload,
      }

      const binaryPathsWithEngineType = await download(downloadParams)
      const binaryPaths: EnginePaths = mapKeys(binaryPathsWithEngineType, binaryTypeToEngineType)
      binaryPathsByVersion[currentVersion] = binaryPaths
    }

    if (binaryPathsOverride) {
      const overrideEngines = Object.keys(binaryPathsOverride)
      const enginesCoveredByOverride = neededVersion.engines.filter((engine) => overrideEngines.includes(engine))
      if (enginesCoveredByOverride.length > 0) {
        for (const engine of enginesCoveredByOverride) {
          const enginePath = binaryPathsOverride[engine]!
          binaryPathsByVersion[currentVersion][engine] = {
            [platform]: enginePath,
          }
        }
      }
    }
  }

  return binaryPathsByVersion
}
