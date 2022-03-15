import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'

import { handle } from '../../../../helpers/blaze/handle'
import { DbPush } from '../../../migrate/src/commands/DbPush'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteFolderPath, getTestSuiteSchemaPath } from './getTestSuiteInfo'
import type { TestSuiteMeta } from './setupClientTest'

export function setupClientFolder(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)

  handle(() => fs.removeSync(suiteFolder))
  fs.copySync(path.join(suiteMeta.testDir, 'prisma'), path.join(suiteFolder, 'prisma'))
  fs.copySync(path.join(suiteMeta.testDir, 'tests.ts'), path.join(suiteFolder, 'tests.ts'))

  const testsContents = fs.readFileSync(path.join(suiteFolder, 'tests.ts'))
  const newTestsContents = testsContents.toString().replace('../../', '../../../../')
  fs.writeFileSync(path.join(suiteFolder, 'tests.ts'), newTestsContents)
}

export function setupClientSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig, schema: string) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  fs.writeFileSync(schemaPath, schema)
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
