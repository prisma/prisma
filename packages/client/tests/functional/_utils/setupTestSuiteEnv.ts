import { faker } from '@faker-js/faker'
import { assertNever } from '@prisma/internals'
import * as miniProxy from '@prisma/mini-proxy'
import fs from 'fs-extra'
import path from 'path'
import { match } from 'ts-pattern'
import { Script } from 'vm'

import { DbDrop } from '../../../../migrate/src/commands/DbDrop'
import { DbExecute } from '../../../../migrate/src/commands/DbExecute'
import { DbPush } from '../../../../migrate/src/commands/DbPush'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteFolderPath, getTestSuiteSchemaPath } from './getTestSuiteInfo'
import { ProviderFlavors, Providers } from './providers'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { AlterStatementCallback, ClientMeta } from './types'

const DB_NAME_VAR = 'PRISMA_DB_NAME'

/**
 * Copies the necessary files for the generated test suite folder.
 * @param suiteMeta
 * @param suiteConfig
 */
export async function setupTestSuiteFiles(suiteMeta: TestSuiteMeta, suiteConfig: NamedTestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)

  // we copy the minimum amount of files needed for the test suite
  await fs.copy(path.join(suiteMeta.testRoot, 'prisma'), path.join(suiteFolder, 'prisma'))
  await fs.mkdir(path.join(suiteFolder, suiteMeta.rootRelativeTestDir), { recursive: true })
  await copyPreprocessed(
    suiteMeta.testPath,
    path.join(suiteFolder, suiteMeta.rootRelativeTestPath),
    suiteConfig.matrixOptions,
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
 */
async function copyPreprocessed(from: string, to: string, suiteConfig: Record<string, string>): Promise<void> {
  // we adjust the relative paths to work from the generated folder
  const contents = await fs.readFile(from, 'utf8')
  const newContents = contents
    .replace(/'\.\.\//g, "'../../../")
    .replace(/'\.\//g, "'../../")
    .replace(/'\.\.\/\.\.\/node_modules/g, "'./node_modules")
    .replace(/\/\/\s*@ts-ignore.*/g, '')
    .replace(/\/\/\s*@ts-test-if:(.+)/g, (match, condition) => {
      if (!evaluateMagicComment(condition, suiteConfig)) {
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
 * @returns
 */
function evaluateMagicComment(conditionFromComment: string, suiteConfig: Record<string, string>): boolean {
  const script = new Script(conditionFromComment)
  const value = script.runInNewContext({
    ...suiteConfig,
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
  alterStatementCallback?: AlterStatementCallback,
) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)
  if (process.env.RECORDINGS == 'read') return

  try {
    const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
    const dbPushParams = ['--schema', schemaPath, '--skip-generate']

    // we reuse and clean the db when running in single-threaded mode
    if (process.env.JEST_MAX_WORKERS === '1') {
      dbPushParams.push('--force-reset')
    }
    await DbPush.new().parse(dbPushParams)

    if (suiteConfig.matrixOptions.providerFlavor === ProviderFlavors.VITESS_8) {
      await new Promise((r) => setTimeout(r, 300)) // wait for vitess to catch up
    }

    if (alterStatementCallback) {
      const { provider } = suiteConfig.matrixOptions
      const prismaDir = path.dirname(schemaPath)
      const timestamp = new Date().getTime()

      if (provider === 'mongodb') {
        throw new Error('DbExecute not supported with mongodb')
      }

      await fs.promises.mkdir(`${prismaDir}/migrations/${timestamp}`, { recursive: true })
      await fs.promises.writeFile(`${prismaDir}/migrations/migration_lock.toml`, `provider = "${provider}"`)
      await fs.promises.writeFile(
        `${prismaDir}/migrations/${timestamp}/migration.sql`,
        alterStatementCallback(provider),
      )

      await DbExecute.new().parse([
        '--file',
        `${prismaDir}/migrations/${timestamp}/migration.sql`,
        '--schema',
        `${schemaPath}`,
      ])
    }

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
  if (process.env.RECORDINGS == 'read') return

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
  directEnvVarName: string
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
export function setupTestSuiteDbURI(
  suiteConfig: NamedTestSuiteConfig['matrixOptions'],
  clientMeta: ClientMeta,
): DatasourceInfo {
  const { provider, providerFlavor } = suiteConfig

  const envVarName = `DATABASE_URI_${provider}`
  const directEnvVarName = `DIRECT_${envVarName}`

  let databaseUrl = match(providerFlavor)
    .with(undefined, () => getDbUrl(provider))
    .otherwise(() => getDbUrlFromFlavor(providerFlavor, provider))

  if (process.env.JEST_MAX_WORKERS === '1') {
    // we reuse and clean the same db when running in single-threaded mode
    databaseUrl = databaseUrl.replace(DB_NAME_VAR, 'test-0000-00000000')
  } else {
    const dbId = `${faker.string.alphanumeric(5)}-${process.pid}-${Date.now()}`
    databaseUrl = databaseUrl.replace(DB_NAME_VAR, dbId)
  }

  let dataProxyUrl: string | undefined
  if (clientMeta.dataProxy) {
    dataProxyUrl = miniProxy.generateConnectionString({
      databaseUrl,
      envVar: envVarName,
      port: miniProxy.defaultServerConfig.port,
    })
  }

  return {
    directEnvVarName,
    envVarName,
    databaseUrl,
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
 * Returns configured database URL for specified provider flavor, falling back to
 * `getDbUrl(provider)` if no flavor-specific URL is configured.
 * @param providerFlavor provider variant, e.g. `vitess` for `mysql`
 * @param provider provider supported by Prisma, e.g. `mysql`
 */
function getDbUrlFromFlavor(providerFlavor: ProviderFlavors | undefined, provider: Providers): string {
  return match(providerFlavor)
    .with(ProviderFlavors.VITESS_8, () => requireEnvVariable('TEST_FUNCTIONAL_VITESS_8_URI'))
    .with(ProviderFlavors.JS_PG, () => requireEnvVariable('TEST_FUNCTIONAL_POSTGRES_URI'))
    .with(ProviderFlavors.JS_NEON, () => requireEnvVariable('TEST_FUNCTIONAL_POSTGRES_URI'))
    .with(ProviderFlavors.JS_PLANETSCALE, () => requireEnvVariable('TEST_FUNCTIONAL_VITESS_8_URI'))
    .with(ProviderFlavors.JS_LIBSQL, () => requireEnvVariable('TEST_FUNCTIONAL_LIBSQL_FILE_URI'))
    .otherwise(() => getDbUrl(provider))
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
