import { enginesVersion, getEnginesPath } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import { getNapiName, getPlatform } from '@prisma/get-platform'
import {
  extractPreviewFeatures,
  getConfig,
  getEnvPaths,
  getRelativeSchemaPath,
  mapPreviewFeatures,
  parseEnvValue,
  printConfigWarnings,
} from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { parse } from 'stacktrace-parser'
import { promisify } from 'util'
import { getDMMF } from '../generation/getDMMF'
import {
  getPrismaClient,
  GetPrismaClientOptions,
} from '../runtime/getPrismaClient'
import { generateInFolder } from './generateInFolder'

const readFile = promisify(fs.readFile)

/**
 * Returns an in-memory client for testing
 */
export async function getTestClient(
  schemaDir?: string,
  printWarnings?: boolean,
): Promise<any> {
  if (!schemaDir) {
    const callsite = parse(new Error('').stack!)
    schemaDir = path.dirname(callsite[1].file!)
  }
  const schemaPath = await getRelativeSchemaPath(schemaDir)
  const datamodel = await readFile(schemaPath!, 'utf-8')
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  if (printWarnings) {
    printConfigWarnings(config.warnings)
  }

  const generator = config.generators.find(
    (g) => parseEnvValue(g.provider) === 'prisma-client-js',
  )
  const previewFeatures = mapPreviewFeatures(extractPreviewFeatures(config))
  const enginesPath = getEnginesPath()
  const platform = await getPlatform()
  const napiLibraryPath = path.join(enginesPath, getNapiName(platform, 'fs'))
  if (
    (previewFeatures.includes('nApi') || process.env.PRISMA_FORCE_NAPI) &&
    !fs.existsSync(napiLibraryPath)
  ) {
    // This is required as the NAPI library is not downloaded by default
    await download({
      binaries: {
        'libquery-engine-napi': enginesPath,
      },
      version: enginesVersion,
    })
  }
  const document = await getDMMF({
    datamodel,
    previewFeatures,
  })
  const outputDir = schemaDir
  const relativeEnvPaths = getEnvPaths(schemaPath, { cwd: schemaDir })
  const activeProvider = config.datasources[0].activeProvider
  const options: GetPrismaClientOptions = {
    document,
    generator,
    dirname: schemaDir,
    relativePath: path.relative(outputDir, schemaDir),
    clientVersion: 'client-test-version',
    engineVersion: 'engine-test-version',
    relativeEnvPaths,
    datasourceNames: config.datasources.map((d) => d.name),
    activeProvider,
  }

  return getPrismaClient(options)
}

/**
 * Actually generates a test client with its own query-engine into ./@prisma/client
 */
export async function generateTestClient(projectDir?: string): Promise<any> {
  if (!projectDir) {
    const callsite = parse(new Error('').stack!)
    projectDir = path.dirname(callsite[1].file!)
  }

  await generateInFolder({
    projectDir,
    useLocalRuntime: false,
    transpile: true,
    useBuiltRuntime: false,
  })
}
