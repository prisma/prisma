import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'

import { DbPush } from '../../../migrate/src/commands/DbPush'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteFolderPath, getTestSuiteSchemaPath } from './getTestSuiteInfo'
import type { TestSuiteMeta } from './setupClientTest'

export async function setupClientFolder(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)

  await fs.rm(suiteFolder, { recursive: true }).catch(() => {})
  await fs.copy(path.join(suiteMeta.testDir, 'prisma'), path.join(suiteFolder, 'prisma'))
  await fs.copy(path.join(suiteMeta.testDir, 'tests.ts'), path.join(suiteFolder, 'tests.ts'))

  const testsContents = await fs.readFile(path.join(suiteFolder, 'tests.ts'))
  const newTestsContents = testsContents.toString().replace('../../', '../../../../')
  await fs.writeFile(path.join(suiteFolder, 'tests.ts'), newTestsContents)
}

export async function setupClientSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig, schema: string) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  await fs.writeFile(schemaPath, schema)
}

export async function setupClientDatabase(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
  await DbPush.new().parse(['--schema', schemaPath, '--force-reset', '--skip-generate'])
  consoleInfoMock.mockRestore()
}

export function setupClientDbURI(suiteConfig: TestSuiteConfig) {
  const dbId = crypto.randomBytes(8).toString('hex')
  const envVarName = `DATABASE_URI_${suiteConfig['#PROVIDER']}`
  const uriRegex = /(\w+:\/\/\w+:\w+@\w+:\d+\/)((?:\w|-)+)(.*)/g
  const newURI = process.env[envVarName]?.replace(uriRegex, `$1$2${dbId}$3`)

  return { [envVarName]: newURI }
}
