import Debug from '@prisma/debug'
import { enginesVersion, getEnginesPath } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import {
  extractPreviewFeatures,
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
    throw new Error(
      `Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`,
    )
  }
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }

  const schemaPath = getSchemaPath(projectDir)
  const datamodel = fs.readFileSync(schemaPath, 'utf-8')

  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  const previewFeatures = mapPreviewFeatures(extractPreviewFeatures(config))
  const useNodeAPI =
    previewFeatures.includes('nApi') || process.env.PRISMA_FORCE_NAPI === 'true'

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

  let runtimePath
  if (useLocalRuntime) {
    if (useBuiltRuntime) {
      runtimePath = path.relative(
        outputDir,
        path.join(__dirname, '../../runtime'),
      )
    } else {
      runtimePath = path.relative(outputDir, path.join(__dirname, '../runtime'))
    }
  } else if (useBuiltRuntime) {
    throw new Error(
      `Please provide useBuiltRuntime and useLocalRuntime at the same time or just useLocalRuntime`,
    )
  }
  const enginesPath = getEnginesPath()
  const nodeAPILibraryPath = path.join(
    enginesPath,
    getNodeAPIName(platform, 'fs'),
  )
  if (
    (useNodeAPI || process.env.PRISMA_FORCE_NAPI) &&
    !fs.existsSync(nodeAPILibraryPath)
  ) {
    // This is required as the Node-API library is not downloaded by default
    await download({
      binaries: {
        'libquery-engine': enginesPath,
      },
      version: enginesVersion,
    })
  }
  const binaryPaths = useNodeAPI
    ? {
        libqueryEngine: {
          [platform]: nodeAPILibraryPath,
        },
      }
    : {
        queryEngine: {
          [platform]: path.join(
            enginesPath,
            `query-engine-${platform}${platform === 'windows' ? '.exe' : ''}`,
          ),
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
    schemaDir: path.dirname(schemaPath),
    runtimePath,
    transpile,
    testMode: true,
    datamodelPath: schemaPath,
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
  throw new Error(
    `Could not find any schema.prisma in ${projectDir} or sub directories.`,
  )
}
