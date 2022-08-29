import { assertNever } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import cuid from 'cuid'
import fs from 'fs-extra'
import path from 'path'
import { Script } from 'vm'

import { DbDrop } from '../../../../migrate/src/commands/DbDrop'
import { DbPush } from '../../../../migrate/src/commands/DbPush'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteFolderPath, getTestSuiteSchemaPath } from './getTestSuiteInfo'
import { Providers } from './providers'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta } from './types'

const DB_NAME_VAR = 'PRISMA_DB_NAME'

/**
 * Copies the necessary files for the generated test suite folder.
 * @param suiteMeta
 * @param suiteConfig
 * @param clientMeta
 */
export async function setupTestSuiteFiles(
  suiteMeta: TestSuiteMeta,
  suiteConfig: NamedTestSuiteConfig,
  clientMeta: ClientMeta,
) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)

  // we copy the minimum amount of files needed for the test suite
  await fs.copy(path.join(suiteMeta.testRoot, 'prisma'), path.join(suiteFolder, 'prisma'))
  await fs.mkdir(path.join(suiteFolder, suiteMeta.rootRelativeTestDir), { recursive: true })
  await copyPreprocessed(
    suiteMeta.testPath,
    path.join(suiteFolder, suiteMeta.rootRelativeTestPath),
    suiteConfig.matrixOptions,
    clientMeta,
  )
}

/**
 * Copies test file into generated subdirectory and pre-processes it
 * in the following way:
 *
 * 1. Adjusts relative imports so they'll work from generated subfolder
 * 2. Evaluates @ts-test-if magic comments and replaces them with @ts-expect-error
 * if necessary
 *
 * @param from
 * @param to
 * @param suiteConfig
 * @param clientMeta
 */
async function copyPreprocessed(
  from: string,
  to: string,
  suiteConfig: Record<string, string>,
  clientMeta: ClientMeta,
): Promise<void> {
  // we adjust the relative paths to work from the generated folder
  const contents = await fs.readFile(from, 'utf8')
  const newContents = contents
    .replace(/'..\//g, "'../../../")
    .replace(/'.\//g, "'../../")
    .replace(/'..\/..\/node_modules/g, "'./node_modules")
    .replace(/\/\/\s*@ts-ignore.*/g, '')
    .replace(/\/\/\s*@ts-test-if:(.+)/g, (match, condition) => {
      if (!evaluateMagicComment(condition, suiteConfig, clientMeta)) {
        return '// @ts-expect-error'
      }
      return match
    })

  await fs.writeFile(to, newContents, 'utf8')
}

/**
 * Evaluates the condition from @ts-test-if magic comment as
 * a JS expression.
 * All properties from suite config are available as variables
 * within the expression.
 *
 * @param conditionFromComment
 * @param suiteConfig
 * @param clientMeta
 * @returns
 */
function evaluateMagicComment(
  conditionFromComment: string,
  suiteConfig: Record<string, string>,
  clientMeta: ClientMeta,
): boolean {
  const script = new Script(conditionFromComment)
  const value = script.runInNewContext({
    ...suiteConfig,
    clientMeta,
  })
  return Boolean(value)
}

/**
 * Write the generated test suite schema to the test suite folder.
 * @param suiteMeta
 * @param suiteConfig
 * @param schema
 */
export async function setupTestSuiteSchema(
  suiteMeta: TestSuiteMeta,
  suiteConfig: NamedTestSuiteConfig,
  schema: string,
) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  await fs.writeFile(schemaPath, schema)
}

/**
 * Create a database for the generated schema of the test suite.
 * @param suiteMeta
 * @param suiteConfig
 */
export async function setupTestSuiteDatabase(
  suiteMeta: TestSuiteMeta,
  suiteConfig: NamedTestSuiteConfig,
  errors: Error[] = [],
) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  try {
    const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
    await DbPush.new().parse(['--schema', schemaPath, '--force-reset', '--skip-generate'])
    consoleInfoMock.mockRestore()
  } catch (e) {
    errors.push(e as Error)

    if (errors.length > 2) {
      throw new Error(errors.map((e) => `${e.message}\n${e.stack}`).join(`\n`))
    } else {
      await setupTestSuiteDatabase(suiteMeta, suiteConfig, errors) // retry logic
    }
  }
}

/**
 * Drop the database for the generated schema of the test suite.
 * @param suiteMeta
 * @param suiteConfig
 */
export async function dropTestSuiteDatabase(
  suiteMeta: TestSuiteMeta,
  suiteConfig: NamedTestSuiteConfig,
  errors: Error[] = [],
) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  try {
    const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
    await DbDrop.new().parse(['--schema', schemaPath, '--force', '--preview-feature'])
    consoleInfoMock.mockRestore()
  } catch (e) {
    errors.push(e as Error)

    if (errors.length > 2) {
      throw new Error(errors.map((e) => `${e.message}\n${e.stack}`).join(`\n`))
    } else {
      await dropTestSuiteDatabase(suiteMeta, suiteConfig, errors) // retry logic
    }
  }
}

export type DatasourceInfo = {
  envVarName: string
  databaseUrl: string
  dataProxyUrl?: string
}

/**
 * Generate a random string to be used as a test suite db name, and derive the
 * corresponding database URL and, if required, Mini-Proxy connection string to
 * that database.
 *
 * @param suiteConfig
 * @param clientMeta
 * @returns
 */
export function setupTestSuiteDbURI(suiteConfig: Record<string, string>, clientMeta: ClientMeta): DatasourceInfo {
  const provider = suiteConfig['provider'] as Providers
  const dbId = cuid()
  const envVarName = `DATABASE_URI_${provider}`
  const newURI = getDbUrl(provider).replace(DB_NAME_VAR, dbId)

  let dataProxyUrl: string | undefined

  if (clientMeta.dataProxy) {
    dataProxyUrl = miniProxy.generateConnectionString({
      databaseUrl: newURI,
      envVar: envVarName,
      port: miniProxy.defaultServerConfig.port,
    })
  }

  return {
    envVarName,
    databaseUrl: newURI,
    dataProxyUrl,
  }
}

/**
 * Returns configured database URL for specified provider
 * @param provider
 * @returns
 */
function getDbUrl(provider: Providers): string {
  switch (provider) {
    case Providers.SQLITE:
      return `file:${DB_NAME_VAR}.db`
    case Providers.MONGODB:
      return requireEnvVariable('TEST_FUNCTIONAL_MONGO_URI')
    case Providers.POSTGRESQL:
      return requireEnvVariable('TEST_FUNCTIONAL_POSTGRES_URI')
    case Providers.MYSQL:
      return requireEnvVariable('TEST_FUNCTIONAL_MYSQL_URI')
    case Providers.COCKROACHDB:
      return requireEnvVariable('TEST_FUNCTIONAL_COCKROACH_URI')
    case Providers.SQLSERVER:
      return requireEnvVariable('TEST_FUNCTIONAL_MSSQL_URI')
    default:
      assertNever(provider, `No URL for provider ${provider} configured`)
  }
}

/**
 * Gets the value of environment variable or throws error if it is not set
 * @param varName
 * @returns
 */
function requireEnvVariable(varName: string): string {
  const value = process.env[varName]
  if (!value) {
    throw new Error(
      `Required env variable ${varName} is not set. See https://github.com/prisma/prisma/blob/main/TESTING.md for instructions`,
    )
  }
  if (!value.includes(DB_NAME_VAR)) {
    throw new Error(
      `Env variable ${varName} must include ${DB_NAME_VAR} placeholder. See https://github.com/prisma/prisma/blob/main/TESTING.md for instructions`,
    )
  }
  return value
}
