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
  useLocalRuntime?: boolean
  transpile?: boolean
  packageSource?: string
  useBuiltRuntime?: boolean
  overrideEngineType?: ClientEngineType
}

export async function generateInFolder({
  projectDir,
  useLocalRuntime = false,
  transpile = true,
  packageSource,
  useBuiltRuntime,
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

  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  const previewFeatures = extractPreviewFeatures(config)
  const clientGenerator = config.generators[0]
  const clientEngineType = overrideEngineType ?? getClientEngineType(clientGenerator)

  const outputDir = transpile
    ? path.join(projectDir, 'node_modules/@prisma/client')
    : path.join(projectDir, '@prisma/client')

  // if (transpile && config.generators[0]?.output) {
  //   outputDir = path.join(path.dirname(schemaPath), config.generators[0]?.output)
  // }

  await del(outputDir)

  if (transpile) {
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
  }

  const binaryTarget = await getBinaryTargetForCurrentPlatform()

  let runtimeDirs
  if (useLocalRuntime) {
    if (useBuiltRuntime) {
      runtimeDirs = {
        node: path.relative(outputDir, path.join(__dirname, '../../runtime')),
        edge: path.relative(outputDir, path.join(__dirname, '../../runtime/edge')),
      }
    } else {
      runtimeDirs = {
        node: path.relative(outputDir, path.join(__dirname, '../runtime')),
        edge: path.relative(outputDir, path.join(__dirname, '../runtime/edge')),
      }
    }
  } else if (useBuiltRuntime) {
    throw new Error(`Please provide useBuiltRuntime and useLocalRuntime at the same time or just useLocalRuntime`)
  }
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
    runtimeDirs,
    transpile,
    testMode: true,
    schemaPath,
    copyRuntime: false,
    generator: config.generators[0],
    clientVersion: 'local',
    engineVersion: 'local',
    activeProvider: config.datasources[0].activeProvider,
    overrideEngineType,
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
