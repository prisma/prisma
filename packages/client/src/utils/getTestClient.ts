import { getPlatform } from '@prisma/get-platform'
import {
  ClientEngineType,
  extractPreviewFeatures,
  getClientEngineType,
  getConfig,
  getEnvPaths,
  getRelativeSchemaPath,
  mapPreviewFeatures,
  parseEnvValue,
  printConfigWarnings,
} from '@prisma/internals'
import fs from 'fs'
import path from 'path'
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
  const schemaPath = await getRelativeSchemaPath(absSchemaDir)
  const datamodel = await fs.promises.readFile(schemaPath!, 'utf-8')
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  if (printWarnings) {
    printConfigWarnings(config.warnings)
  }

  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')
  const previewFeatures = mapPreviewFeatures(extractPreviewFeatures(config))
  const platform = await getPlatform()
  const clientEngineType = getClientEngineType(generator!)
  ;(global as any).TARGET_ENGINE_TYPE = clientEngineType === ClientEngineType.Library ? 'library' : 'binary'

  await ensureTestClientQueryEngine(clientEngineType, platform)

  const document = await getDMMF({
    datamodel,
    previewFeatures,
  })
  const outputDir = absSchemaDir
  const relativeEnvPaths = getEnvPaths(schemaPath, { cwd: absSchemaDir })
  const activeProvider = config.datasources[0].activeProvider
  const options: GetPrismaClientConfig = {
    runtimeDataModel: dmmfToRuntimeDataModel(document.datamodel),
    generator,
    dirname: absSchemaDir,
    relativePath: path.relative(outputDir, absSchemaDir),
    clientVersion: 'client-test-version',
    engineVersion: 'engine-test-version',
    relativeEnvPaths,
    datasourceNames: config.datasources.map((d) => d.name),
    activeProvider,
    dataProxy: Boolean(process.env.TEST_DATA_PROXY),
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
