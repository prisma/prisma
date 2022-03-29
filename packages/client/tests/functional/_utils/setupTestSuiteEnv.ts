import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'

import { DbDrop } from '../../../../migrate/src/commands/DbDrop'
import { DbPush } from '../../../../migrate/src/commands/DbPush'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteFolderPath, getTestSuiteSchemaPath } from './getTestSuiteInfo'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

/**
 * Copies the necessary files for the generated test suite folder.
 * @param suiteMeta
 * @param suiteConfig
 */
export async function setupTestSuiteFiles(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)

  await fs.copy(path.join(suiteMeta.testDir, 'prisma'), path.join(suiteFolder, 'prisma'))
  await fs.copy(path.join(suiteMeta.testDir, 'tests.ts'), path.join(suiteFolder, 'tests.ts'))
  await fs.copy(path.join(suiteMeta.testDir, 'package.json'), path.join(suiteFolder, 'package.json')).catch(() => {})

  const testsContents = await fs.readFile(path.join(suiteFolder, 'tests.ts'))
  const newTestsContents = testsContents.toString().replace("'../", "'../../../")

  await fs.writeFile(path.join(suiteFolder, 'tests.ts'), newTestsContents)
}

/**
 * Write the generated test suite schema to the test suite folder.
 * @param suiteMeta
 * @param suiteConfig
 * @param schema
 */
export async function setupTestSuiteSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig, schema: string) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  await fs.writeFile(schemaPath, schema)
}

/**
 * Create a database for the generated schema of the test suite.
 * @param suiteMeta
 * @param suiteConfig
 */
export async function setupTestSuiteDatabase(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  try {
    const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
    await DbPush.new().parse(['--schema', schemaPath, '--force-reset', '--skip-generate'])
    consoleInfoMock.mockRestore()
  } catch (e) {
    await setupTestSuiteDatabase(suiteMeta, suiteConfig)
  }
}

/**
 * Drop the database for the generated schema of the test suite.
 * @param suiteMeta
 * @param suiteConfig
 */
export async function dropTestSuiteDatabase(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  try {
    const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
    await DbDrop.new().parse(['--schema', schemaPath, '--force', '--preview-feature'])
    consoleInfoMock.mockRestore()
  } catch (e) {
    await dropTestSuiteDatabase(suiteMeta, suiteConfig)
  }
}

/**
 * Generate a random string to be used as a test suite db url.
 * @param suiteConfig
 * @returns
 */
export function setupTestSuiteDbURI(suiteConfig: TestSuiteConfig) {
  const dbId = crypto.randomBytes(8).toString('hex')
  const envVarName = `DATABASE_URI_${suiteConfig['#PROVIDER']}`
  const uriRegex = /(\w+:\/\/\w+:\w+@\w+:\d+\/)((?:\w|-)+)(.*)/g
  const newURI = process.env[envVarName]?.replace(uriRegex, `$1$2${dbId}$3`)

  return { [envVarName]: newURI }
}
