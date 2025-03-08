import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import {
  ClientEngineType,
  extractPreviewFeatures,
  getClientEngineType,
  getConfig,
  getEnvPaths,
  getSchemaWithPath,
  parseEnvValue,
  printConfigWarnings,
} from '@prisma/internals'
import path from 'node:path'
import { parse } from 'stacktrace-parser'

import { getDMMF } from '../generation/getDMMF'
import { dmmfToRuntimeDataModel } from '../runtime/core/runtimeDataModel'
import type { GetPrismaClientConfig } from '../runtime/getPrismaClient'
import { getPrismaClient } from '../runtime/getPrismaClient'
import { ensureTestClientQueryEngine } from './ensureTestClientQueryEngine'
import { generateInFolder } from './generateInFolder'

//TODO Rename to generateTestClientInMemory
/**
 * Returns an in-memory client for testing
 */
export async function getTestClient(schemaDir?: string, printWarnings?: boolean): Promise<any> {
  const callSite = path.dirname(require.main?.filename ?? '')
  const absSchemaDir = path.resolve(callSite, schemaDir ?? '')

  const { schemaPath, schemas: datamodel } = (await getSchemaWithPath(undefined, undefined, { cwd: absSchemaDir }))!

  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  if (printWarnings) {
    printConfigWarnings(config.warnings)
  }

  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')
  const previewFeatures = extractPreviewFeatures(config)
  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  const clientEngineType = getClientEngineType(generator!)
  ;(global as any).TARGET_BUILD_TYPE = clientEngineType === ClientEngineType.Library ? 'library' : 'binary'

  await ensureTestClientQueryEngine(clientEngineType, binaryTarget)

  const document = await getDMMF({
    datamodel,
    previewFeatures,
  })
  const outputDir = absSchemaDir
  const relativeEnvPaths = await getEnvPaths(schemaPath, { cwd: absSchemaDir })
  const activeProvider = config.datasources[0].activeProvider
  const options: GetPrismaClientConfig = {
    runtimeDataModel: dmmfToRuntimeDataModel(document.datamodel),
    generator,
    dirname: absSchemaDir,
    relativePath: path.relative(outputDir, absSchemaDir),
    clientVersion: '0.0.0',
    engineVersion: '0000000000000000000000000000000000000000',
    relativeEnvPaths,
    datasourceNames: config.datasources.map((d) => d.name),
    activeProvider,
    inlineDatasources: { db: { url: config.datasources[0].url } },
    inlineSchema: datamodel[0][1], // TODO: merge schemas
    inlineSchemaHash: '',
  }

  return getPrismaClient(options)
}

/**
 * Options of `generateTestClient` function.
 */
type GenerateTestClientOptions = {
  /**
   * Directory to search for the schema in and generate the client in.
   */
  projectDir?: string

  /**
   * Overrides the query engine type, if specified, and makes the client ignore
   * the `PRISMA_CLIENT_ENGINE_TYPE` environment variable and `engineType` schema field.
   */
  engineType?: ClientEngineType
}

/**
 * Actually generates a test client with its own query-engine into ./@prisma/client
 */
export async function generateTestClient({ projectDir, engineType }: GenerateTestClientOptions = {}): Promise<any> {
  if (!projectDir) {
    const callsite = parse(new Error('').stack!)
    projectDir = path.dirname(callsite[1].file!)
  }

  await generateInFolder({
    projectDir,
    overrideEngineType: engineType,
  })
}
