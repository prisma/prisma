import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import { Script } from 'vm'

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

  // we copy the minimum amount of files needed for the test suite
  await fs.copy(path.join(suiteMeta.testDir, 'prisma'), path.join(suiteFolder, 'prisma'))
  await copyPreprocessed(
    path.join(suiteMeta.testDir, suiteMeta.testFileName),
    path.join(suiteFolder, suiteMeta.testFileName),
    suiteConfig,
  )
  await copyPreprocessed(path.join(suiteMeta.testDir, '_matrix.ts'), path.join(suiteFolder, '_matrix.ts'), suiteConfig)
  await fs.copy(path.join(suiteMeta.testDir, 'package.json'), path.join(suiteFolder, 'package.json')).catch(() => {})
}

async function copyPreprocessed(from: string, to: string, suiteConfig: TestSuiteConfig): Promise<void> {
  // we adjust the relative paths to work from the generated folder
  const contents = await fs.readFile(from, 'utf8')
  const newContents = contents
    .replace(/'..\//g, "'../../../")
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
function evaluateMagicComment(conditionFromComment: string, suiteConfig: TestSuiteConfig): boolean {
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
export async function setupTestSuiteSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig, schema: string) {
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
  suiteConfig: TestSuiteConfig,
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
  suiteConfig: TestSuiteConfig,
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

/**
 * Generate a random string to be used as a test suite db url.
 * @param suiteConfig
 * @returns
 */
export function setupTestSuiteDbURI(suiteConfig: TestSuiteConfig) {
  // we reuse the original db url but postfix it with a random string
  const dbId = crypto.randomBytes(8).toString('hex')
  const envVarName = `DATABASE_URI_${suiteConfig['provider']}`
  const uriRegex = /(\w+:\/\/\w+:\w+@\w+:\d+\/)((?:\w|-)+)(.*)/g
  const newURI = process.env[envVarName]?.replace(uriRegex, `$1$2${dbId}$3`)

  return { [envVarName]: newURI }
}
