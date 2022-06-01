import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import {
  ClientEngineType,
  extractPreviewFeatures,
  getClientEngineType,
  getConfig,
  getDMMF,
  getPackedPackage,
  mapPreviewFeatures,
} from '@prisma/sdk'
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
}

export async function generateInFolder({
  projectDir,
  useLocalRuntime = false,
  transpile = true,
  packageSource,
  useBuiltRuntime,
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
  const previewFeatures = mapPreviewFeatures(extractPreviewFeatures(config))
  const clientGenerator = config.generators[0]
  const clientEngineType = getClientEngineType(clientGenerator)

  const dmmf = await getDMMF({
    datamodel,
    previewFeatures,
  })

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

  const platform = await getPlatform()

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
  const queryEngineLibraryPath = path.join(enginesPath, getNodeAPIName(platform, 'fs'))
  const queryEngineBinaryPath = path.join(
    enginesPath,
    `query-engine-${platform}${platform === 'windows' ? '.exe' : ''}`,
  )

  await ensureTestClientQueryEngine(clientEngineType, platform)

  const binaryPaths =
    clientEngineType === ClientEngineType.Library
      ? {
          libqueryEngine: {
            [platform]: queryEngineLibraryPath,
          },
        }
      : {
          queryEngine: {
            [platform]: queryEngineBinaryPath,
          },
        }

  // we make sure that we are in the project root
  // this only applies to generated test clients
  process.chdir(projectDir)

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
    dataProxy: !!process.env.DATA_PROXY,
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
