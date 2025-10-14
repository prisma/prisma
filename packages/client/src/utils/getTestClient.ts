import { dmmfToRuntimeDataModel, GetPrismaClientConfig } from '@prisma/client-common'
import { getDMMF } from '@prisma/client-generator-js'
import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import {
  ClientEngineType,
  extractPreviewFeatures,
  getClientEngineType,
  getConfig,
  getSchemaWithPath,
  parseEnvValue,
  printConfigWarnings,
} from '@prisma/internals'
import path from 'path'
import { parse } from 'stacktrace-parser'

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

  const { schemas: datamodel } = (await getSchemaWithPath(undefined, undefined, { cwd: absSchemaDir }))!

  const config = await getConfig({ datamodel })
  if (printWarnings) {
    printConfigWarnings(config.warnings)
  }

  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')
  const previewFeatures = extractPreviewFeatures(config.generators)
  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  const clientEngineType = getClientEngineType(generator!)
  ;(global as any).TARGET_BUILD_TYPE = clientEngineType === ClientEngineType.Library ? 'library' : 'client'

  await ensureTestClientQueryEngine(clientEngineType, binaryTarget)

  const document = await getDMMF({
    datamodel,
    previewFeatures,
  })
  const outputDir = absSchemaDir
  const activeProvider = config.datasources[0].activeProvider
  const options: GetPrismaClientConfig = {
    runtimeDataModel: dmmfToRuntimeDataModel(document.datamodel),
    generator,
    dirname: absSchemaDir,
    relativePath: path.relative(outputDir, absSchemaDir),
    clientVersion: '0.0.0',
    engineVersion: '0000000000000000000000000000000000000000',
    datasourceNames: config.datasources.map((d) => d.name),
    activeProvider,
    inlineDatasources: { db: { url: config.datasources[0].url } },
    inlineSchema: datamodel[0][1], // TODO: merge schemas
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
