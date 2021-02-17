import { getNapiName, getPlatform } from '@prisma/get-platform'
import {
  getConfig,
  getDMMF,
  extractPreviewFeatures,
  mapPreviewFeatures,
} from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { generateClient } from '../generation/generateClient'
import { getPackedPackage } from '@prisma/sdk'
import { getEnginesPath } from '@prisma/engines'
import Debug from '@prisma/debug'
const debug = Debug('prisma:generateInFolder')
import copy from '@timsuchanek/copy'
import rimraf from 'rimraf'
import { promisify } from 'util'
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
  const useNapi = config.generators[0].config?.engine === 'napi'
  const enablePreview = mapPreviewFeatures(extractPreviewFeatures(config))

  const dmmf = await getDMMF({
    datamodel,
    enableExperimental: enablePreview, // it's still called enableExperimental when calling the query engine
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
  await generateClient({
    binaryPaths: useNapi ? {
      libqueryEngineNapi:  {
        [platform]: path.join(
          enginesPath,
          getNapiName(platform, 'fs'),
        ),
      }
    } : {
      queryEngine: {
        [platform]: path.join(
          enginesPath,
          `query-engine-${platform}${platform === 'windows' ? '.exe' : ''}`,
        ),
      },
    },
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
    activeProvider: 'sqlite',
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
