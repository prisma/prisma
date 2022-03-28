import type { DMMF } from '@prisma/generator-helper'
import crypto from 'crypto'
import fs from 'fs-extra'
import path from 'path'

import { handle } from '../../../../helpers/blaze/handle'
import { DbPush } from '../../../migrate/src/commands/DbPush'
import { dmmfToTypes } from '../../src/generation/generator'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteFolderPath, getTestSuiteSchemaPath } from './getTestSuiteInfo'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

export async function setupTestSuiteFiles(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)

  await fs.copy(path.join(suiteMeta.testDir, 'prisma'), path.join(suiteFolder, 'prisma'))
  await fs.copy(path.join(suiteMeta.testDir, 'tests.ts'), path.join(suiteFolder, 'tests.ts'))
  await fs.copy(path.join(suiteMeta.testDir, 'package.json'), path.join(suiteFolder, 'package.json')).catch(() => {})

  const testsContents = await fs.readFile(path.join(suiteFolder, 'tests.ts'))
  const newTestsContents = testsContents.toString().replace('../../', '../../../../')

  fs.writeFileSync(path.join(suiteFolder, 'tests.ts'), newTestsContents)
}

export async function setupTestSuiteTypes(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig, dmmf: DMMF.Document) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const typesFolder = path.join(suiteFolder, 'node_modules', '@prisma/client')
  const typesFile = path.join(typesFolder, 'index.d.ts')
  const types = dmmfToTypes(dmmf)

  await fs.mkdirp(typesFolder)
  await fs.writeFile(typesFile, types)
}

export async function setupTestSuiteSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig, schema: string) {
  const schemaPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)

  await fs.writeFile(schemaPath, schema)
}

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

export function setupTestSuiteDbURI(suiteConfig: TestSuiteConfig) {
  const dbId = crypto.randomBytes(8).toString('hex')
  const envVarName = `DATABASE_URI_${suiteConfig['#PROVIDER']}`
  const uriRegex = /(\w+:\/\/\w+:\w+@\w+:\d+\/)((?:\w|-)+)(.*)/g
  const newURI = process.env[envVarName]?.replace(uriRegex, `$1$2${dbId}$3`)

  return { [envVarName]: newURI }
}
