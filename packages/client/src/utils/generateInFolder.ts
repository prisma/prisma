import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import { getBinaryTargetForCurrentPlatform, getNodeAPIName } from '@prisma/get-platform'
import {
  ClientEngineType,
  extractPreviewFeatures,
  getClientEngineType,
  getConfig,
  getDMMF,
  getPackedPackage,
} from '@prisma/internals'
import copy from '@timsuchanek/copy'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import rimraf from 'rimraf'
import { promisify } from 'util'

import { generateClient } from '../generation/generateClient'
import { ensureTestClientQueryEngine } from './ensureTestClientQueryEngine'

const debug = Debug('prisma:generateInFolder')
const del = promisify(rimraf)

export interface GenerateInFolderOptions {
  projectDir: string
  packageSource?: string
  overrideEngineType?: ClientEngineType
}

export async function generateInFolder({
  projectDir,
  packageSource,
  overrideEngineType,
}: GenerateInFolderOptions): Promise<number> {
  const before = performance.now()
  if (!projectDir) {
    throw new Error(`Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`)
  }
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }

  const schemaPath = getSchemaPath(projectDir)
  const datamodel = fs.readFileSync(schemaPath, 'utf-8')

  if (overrideEngineType) {
    process.env.PRISMA_CLIENT_ENGINE_TYPE = overrideEngineType
  }

  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  const previewFeatures = extractPreviewFeatures(config)
  const clientEngineType = getClientEngineType(config.generators[0])

  const outputDir = path.join(projectDir, 'node_modules/@prisma/client')

  await del(outputDir)

  if (packageSource) {
    await copy({
      from: packageSource, // when using yarn pack and extracting it, it includes a folder called "package"
      to: outputDir,
      recursive: true,
      parallelJobs: 20,
      overwrite: true,
    })
  } else {
    await getPackedPackage('@prisma/client', outputDir)
  }

  const binaryTarget = await getBinaryTargetForCurrentPlatform()

  const enginesPath = getEnginesPath()
  const queryEngineLibraryPath =
    process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? path.join(enginesPath, getNodeAPIName(binaryTarget, 'fs'))
  const queryEngineBinaryPath =
    process.env.PRISMA_QUERY_ENGINE_BINARY ??
    path.join(enginesPath, `query-engine-${binaryTarget}${binaryTarget === 'windows' ? '.exe' : ''}`)

  await ensureTestClientQueryEngine(clientEngineType, binaryTarget)

  const binaryPaths =
    clientEngineType === ClientEngineType.Library
      ? {
          libqueryEngine: {
            [binaryTarget]: queryEngineLibraryPath,
          },
        }
      : {
          queryEngine: {
            [binaryTarget]: queryEngineBinaryPath,
          },
        }

  // TODO: use engine.getDmmf()
  const dmmf = await getDMMF({
    datamodel,
    previewFeatures,
  })

  await generateClient({
    binaryPaths,
    datamodel,
    dmmf,
    ...config,
    outputDir,
    schemaPath,
    testMode: true,
    copyRuntime: false,
    generator: config.generators[0],
    clientVersion: 'local',
    engineVersion: 'local',
    activeProvider: config.datasources[0].activeProvider,
  })

  const time = performance.now() - before
  debug(`Done generating client in ${time}`)

  return time
}

function getSchemaPath(projectDir: string): string {
  if (fs.existsSync(path.join(projectDir, 'schema.prisma'))) {
    return path.join(projectDir, 'schema.prisma')
  }
  if (fs.existsSync(path.join(projectDir, 'prisma/schema.prisma'))) {
    return path.join(projectDir, 'prisma/schema.prisma')
  }
  throw new Error(`Could not find any schema.prisma in ${projectDir} or sub directories.`)
}
