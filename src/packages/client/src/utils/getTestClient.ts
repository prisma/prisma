import { parse } from 'stacktrace-parser'
import path from 'path'
import { getRelativeSchemaPath, getConfig, extractPreviewFeatures, mapPreviewFeatures } from '@prisma/sdk'
import { getDMMF } from '../generation/getDMMF'
import { promisify } from 'util'
import fs from 'fs'
import { GetPrismaClientOptions, getPrismaClient } from '../runtime/getPrismaClient'
import { extractSqliteSources } from '../generation/extractSqliteSources'
import { generateInFolder } from './generateInFolder'
const readFile = promisify(fs.readFile)

/**
 * Returns an in-memory client for testing
 */
export async function getTestClient(): Promise<any> {
  const callsite = parse(new Error('').stack!)
  const schemaDir = path.dirname(callsite[1].file!)
  const schemaPath = await getRelativeSchemaPath(schemaDir)
  const datamodel = await readFile(schemaPath!, 'utf-8')
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
  const generator = config.generators.find(g => g.provider === 'prisma-client-js')
  const enableExperimental = mapPreviewFeatures(
    extractPreviewFeatures(config),
  )
  const document = await getDMMF({
    datamodel,
    enableExperimental
  })
  const outputDir = schemaDir


  const options: GetPrismaClientOptions = {
    document,
    generator,
    dirname: schemaDir,
    relativePath: path.relative(outputDir, schemaDir),
    clientVersion: 'client-test-version',
    engineVersion: 'engine-test-version',
    sqliteDatasourceOverrides: extractSqliteSources(
      datamodel,
      schemaDir,
      outputDir,
    )
  }

  return getPrismaClient(options)
}

/**
 * Actually generates a test client with its own query-engine into ./@prisma/client
 */
export async function generateTestClient(): Promise<any> {
  const callsite = parse(new Error('').stack!)
  const projectDir = path.dirname(callsite[1].file!)

  await generateInFolder({
    projectDir,
    useLocalRuntime: false,
    transpile: true,
    useBuiltRuntime: false
  })
}
