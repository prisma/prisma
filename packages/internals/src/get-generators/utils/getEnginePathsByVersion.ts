import { enginesVersion } from '@prisma/engines'
import type { EngineDownloadConfiguration, DownloadOptions } from '@prisma/fetch-engine'
import { download } from '@prisma/fetch-engine'
import type { EnginePaths, BinaryTargetsEnvValue } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import makeDir from 'make-dir'
import path from 'path'

import { mapKeys } from '../../utils/mapKeys'
import type { GetEnginePathsByVersionInput } from '../getGenerators'
import { barToFoo } from './binaryTypeToEngineType'
import { fooToBar } from './engineTypeToBinaryType'

export async function getEnginePathsByVersion({
  neededVersions,
  platform,
  version,
  printDownloadProgress,
  skipDownload,
  enginePathsOverride,
}: GetEnginePathsByVersionInput): Promise<Record<string, EnginePaths>> {
  const enginePathsByVersion: Record<string, EnginePaths> = Object.create(null)

  // make sure, that at least the current platform is being fetched
  for (const currentVersion in neededVersions) {
    enginePathsByVersion[currentVersion] = {}

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

    const enginesConfig: EngineDownloadConfiguration = neededVersion.engines.reduce((acc, curr) => {
      // only download the engine, of not already covered by the `enginePathsOverride`
      if (!enginePathsOverride?.[curr]) {
        acc[fooToBar(curr)] = binaryTargetBaseDir
      }
      return acc
    }, Object.create(null))

    if (Object.values(enginesConfig).length > 0) {
      // Convert BinaryTargetsEnvValue[] to Platform[]
      const platforms: Platform[] = neededVersion.binaryTargets.map(
        (binaryTarget: BinaryTargetsEnvValue) => binaryTarget.value as Platform,
      )

      const downloadParams: DownloadOptions = {
        engines: enginesConfig,
        binaryTargets: platforms,
        showProgress: typeof printDownloadProgress === 'boolean' ? printDownloadProgress : true,
        version: currentVersion && currentVersion !== 'latest' ? currentVersion : enginesVersion,
        skipDownload,
      }

      const enginePathsWithEngineType = await download(downloadParams)
      const enginePaths: EnginePaths = mapKeys(enginePathsWithEngineType, barToFoo)
      enginePathsByVersion[currentVersion] = enginePaths
    }

    if (enginePathsOverride) {
      const overrideEngines = Object.keys(enginePathsOverride)
      const enginesCoveredByOverride = neededVersion.engines.filter((engine) => overrideEngines.includes(engine))
      if (enginesCoveredByOverride.length > 0) {
        for (const engine of enginesCoveredByOverride) {
          const enginePath = enginePathsOverride[engine]!
          enginePathsByVersion[currentVersion][engine] = {
            [platform]: enginePath,
          }
        }
      }
    }
  }

  return enginePathsByVersion
}
