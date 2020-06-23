import { getPlatform } from '@prisma/get-platform'
import {
  getConfig,
  getDMMF,
  extractExperimentalFeatures,
  mapExperimentalFeatures,
} from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { generateClient } from '../generation/generateClient'
import { getPackedPackage } from '@prisma/sdk'
import Debug from '@prisma/debug'
const debug = Debug('generateInFolder')

export interface GenerateInFolderOptions {
  projectDir: string
  useLocalRuntime?: boolean
  transpile?: boolean
}

export async function generateInFolder({
  projectDir,
  useLocalRuntime = false,
  transpile = true,
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
  const dmmf = await getDMMF({
    datamodel,
    enableExperimental: mapExperimentalFeatures(
      extractExperimentalFeatures(config),
    ),
  })

  const outputDir = transpile
    ? path.join(projectDir, 'node_modules/@prisma/client')
    : path.join(projectDir, '@prisma/client')

  if (transpile) {
    await getPackedPackage('@prisma/client', outputDir)
  }

  const platform = await getPlatform()

  await generateClient({
    binaryPaths: {
      queryEngine: {
        [platform]: path.join(
          __dirname,
          `../../query-engine-${platform}${
            platform === 'windows' ? '.exe' : ''
          }`,
        ),
      },
    },
    datamodel,
    dmmf,
    ...config,
    outputDir,
    schemaDir: path.dirname(schemaPath),
    runtimePath: useLocalRuntime
      ? path.relative(outputDir, path.join(__dirname, '../runtime'))
      : undefined,
    transpile,
    testMode: true,
    datamodelPath: schemaPath,
    copyRuntime: false,
    generator: config.generators[0],
    clientVersion: 'local',
    engineVersion: 'local',
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
