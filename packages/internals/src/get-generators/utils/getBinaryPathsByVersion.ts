import { enginesVersion } from '@prisma/engines'
import type { BinaryDownloadConfiguration, DownloadOptions } from '@prisma/fetch-engine'
import { download } from '@prisma/fetch-engine'
import type { BinaryPaths, BinaryTargetsEnvValue } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import { ensureDir } from 'fs-extra'
import path from 'path'

import { mapKeys } from '../../utils/mapKeys'
import type { GetBinaryPathsByVersionInput } from '../getGenerators'
import { binaryTypeToEngineType } from '../utils/binaryTypeToEngineType'
import { engineTypeToBinaryType } from '../utils/engineTypeToBinaryType'

function parseAWSNodejsRuntimeEnvVarVersion() {
  const runtimeEnvVar = process.env.AWS_LAMBDA_JS_RUNTIME
  if (!runtimeEnvVar || runtimeEnvVar === '') return null

  try {
    const runtimeRegex = /^nodejs(\d+).x$/
    const match = runtimeRegex.exec(runtimeEnvVar)
    if (match) {
      return parseInt(match[1])
    }
  } catch (e) {
    console.error(
      `We could not parse the AWS_LAMBDA_JS_RUNTIME env var with the following value: ${runtimeEnvVar}. This was silently ignored.`,
    )
  }

  return null
}

export async function getBinaryPathsByVersion({
  neededVersions,
  platform,
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
      neededVersion.binaryTargets = [{ fromEnvVar: null, value: platform }]
    }

    if (process.env.NETLIFY) {
      const isNodeMajor20OrUp = parseInt(process.versions.node.split('.')[0]) >= 20

      // Netlify reads and changes the runtime version based on this env var
      // https://docs.netlify.com/configure-builds/environment-variables/#netlify-configuration-variables
      const awsRuntimeVersion = parseAWSNodejsRuntimeEnvVarVersion()
      const isRuntimeEnvVar20OrUp = awsRuntimeVersion && awsRuntimeVersion >= 20

      const isRhelBinaryTarget1xInNeededVersions = neededVersion.binaryTargets.find(
        (object) => object.value === 'rhel-openssl-1.0.x',
      )
      const isRhelBinaryTarget3xInNeededVersions = neededVersion.binaryTargets.find(
        (object) => object.value === 'rhel-openssl-3.0.x',
      )
      if ((isNodeMajor20OrUp || isRuntimeEnvVar20OrUp) && !isRhelBinaryTarget3xInNeededVersions) {
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
            [platform]: enginePath,
          }
        }
      }
    }
  }

  return binaryPathsByVersion
}
