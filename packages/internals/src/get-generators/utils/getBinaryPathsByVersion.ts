import { enginesVersion } from '@prisma/engines'
import type { BinaryDownloadConfiguration, DownloadOptions } from '@prisma/fetch-engine'
import { download } from '@prisma/fetch-engine'
import type { BinaryPaths, BinaryTargetsEnvValue } from '@prisma/generator-helper'
import type { BinaryTarget } from '@prisma/get-platform'
import { ensureDir } from 'fs-extra'
import path from 'node:path'

import { mapKeys } from '../../utils/mapKeys'
import { parseAWSNodejsRuntimeEnvVarVersion } from '../../utils/parseAWSNodejsRuntimeEnvVarVersion'
import type { GetBinaryPathsByVersionInput } from '../getGenerators'
import { binaryTypeToEngineType } from '../utils/binaryTypeToEngineType'
import { engineTypeToBinaryType } from '../utils/engineTypeToBinaryType'

export async function getBinaryPathsByVersion({
  neededVersions,
  binaryTarget,
  version,
  printDownloadProgress,
  skipDownload,
  binaryPathsOverride,
}: GetBinaryPathsByVersionInput): Promise<Record<string, BinaryPaths>> {
  const binaryPathsByVersion: Record<string, BinaryPaths> = Object.create(null)

  // make sure, that at least the current platform is being fetched
  for (const currentVersion in neededVersions) {
    binaryPathsByVersion[currentVersion] = {}

    // ensure binaryTargets are set correctly
    const neededVersion = neededVersions[currentVersion]

    if (neededVersion.binaryTargets.length === 0) {
      neededVersion.binaryTargets = [{ fromEnvVar: null, value: binaryTarget }]
    }

    if (process.env.NETLIFY) {
      const isNodeMajor20OrUp = Number.parseInt(process.versions.node.split('.')[0]) >= 20

      // Netlify reads and changes the runtime version based on this env var
      // https://docs.netlify.com/configure-builds/environment-variables/#netlify-configuration-variables
      const awsRuntimeVersion = parseAWSNodejsRuntimeEnvVarVersion()
      const isRuntimeEnvVar20OrUp = awsRuntimeVersion && awsRuntimeVersion >= 20
      const isRuntimeEnvVar18OrDown = awsRuntimeVersion && awsRuntimeVersion <= 18

      const isRhelBinaryTarget1xInNeededVersions = neededVersion.binaryTargets.find(
        (object) => object.value === 'rhel-openssl-1.0.x',
      )
      const isRhelBinaryTarget3xInNeededVersions = neededVersion.binaryTargets.find(
        (object) => object.value === 'rhel-openssl-3.0.x',
      )

      // Only add 3.0.x if
      // - it's not already added
      // - current Node.js version is 20+ or env var is 20+
      // - env var must not be 18-
      if (
        !isRhelBinaryTarget3xInNeededVersions &&
        (isNodeMajor20OrUp || isRuntimeEnvVar20OrUp) &&
        !isRuntimeEnvVar18OrDown
      ) {
        neededVersion.binaryTargets.push({
          fromEnvVar: null,
          value: 'rhel-openssl-3.0.x',
        })
      } else if (!isRhelBinaryTarget1xInNeededVersions) {
        neededVersion.binaryTargets.push({
          fromEnvVar: null,
          value: 'rhel-openssl-1.0.x',
        })
      }
    }

    // download
    let binaryTargetBaseDir = eval(`require('path').join(__dirname, '..')`)

    if (version !== currentVersion) {
      binaryTargetBaseDir = path.join(binaryTargetBaseDir, `./engines/${currentVersion}/`)
      await ensureDir(binaryTargetBaseDir).catch((e) => console.error(e))
    }

    const binariesConfig: BinaryDownloadConfiguration = neededVersion.engines.reduce((acc, curr) => {
      // only download the binary, of not already covered by the `binaryPathsOverride`
      if (!binaryPathsOverride?.[curr]) {
        acc[engineTypeToBinaryType(curr)] = binaryTargetBaseDir
      }
      return acc
    }, Object.create(null))

    if (Object.values(binariesConfig).length > 0) {
      // Convert BinaryTargetsEnvValue[] to BinaryTarget[]
      const binaryTargets: BinaryTarget[] = neededVersion.binaryTargets.map(
        (binaryTarget: BinaryTargetsEnvValue) => binaryTarget.value as BinaryTarget,
      )

      const downloadParams: DownloadOptions = {
        binaries: binariesConfig,
        binaryTargets: binaryTargets,
        showProgress: typeof printDownloadProgress === 'boolean' ? printDownloadProgress : true,
        version: currentVersion && currentVersion !== 'latest' ? currentVersion : enginesVersion,
        skipDownload,
      }

      const binaryPathsWithEngineType = await download(downloadParams)
      const binaryPaths: BinaryPaths = mapKeys(binaryPathsWithEngineType, binaryTypeToEngineType)
      binaryPathsByVersion[currentVersion] = binaryPaths
    }

    if (binaryPathsOverride) {
      const overrideEngines = Object.keys(binaryPathsOverride)
      const enginesCoveredByOverride = neededVersion.engines.filter((engine) => overrideEngines.includes(engine))
      if (enginesCoveredByOverride.length > 0) {
        for (const engine of enginesCoveredByOverride) {
          const enginePath = binaryPathsOverride[engine]!
          binaryPathsByVersion[currentVersion][engine] = {
            [binaryTarget]: enginePath,
          }
        }
      }
    }
  }

  return binaryPathsByVersion
}
