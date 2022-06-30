import { enginesVersion } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { getConfig, parseEnvValue } from '@prisma/internals'
import fs from 'fs'
import fsExtra from 'fs-extra'
import path from 'path'

import { generateClient } from '../../client/src/generation/generateClient'
import { getDMMF } from '../../client/src/generation/getDMMF'
import { DbPush } from '../../migrate/src/commands/DbPush'

export async function setupQueryEngine() {
  const platform = await getPlatform()
  const engineDownloadDir = path.join(__dirname, 'generated')
  const queryEngineLibraryPath = path.join(engineDownloadDir, getNodeAPIName(platform, 'fs'))

  if (!(await fsExtra.pathExists(engineDownloadDir))) {
    await fs.promises.mkdir(engineDownloadDir)
  }

  if (!(await fsExtra.pathExists(queryEngineLibraryPath))) {
    await download({ binaries: { 'libquery-engine': engineDownloadDir }, version: enginesVersion })
  }
}

export async function setupTestSuiteClient({
  schema,
  provider,
  generatedDir,
  schemaPath,
}: {
  schema: string
  provider: 'postgresql'
  generatedDir: string
  schemaPath: string
}) {
  const dmmf = await getDMMF({ datamodel: schema })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await fs.promises.mkdir(generatedDir)
  await fs.promises.writeFile(schemaPath, schema)

  const outputDir = path.join(generatedDir, 'node_modules/@prisma/client')

  await generateClient({
    datamodel: schema,
    schemaPath,
    binaryPaths: { libqueryEngine: {}, queryEngine: {} },
    datasources: config.datasources,
    outputDir,
    copyRuntime: false,
    dmmf: dmmf,
    generator: generator,
    engineVersion: '0000000000000000000000000000000000000000',
    clientVersion: '0.0.0',
    transpile: false,
    testMode: true,
    activeProvider: provider,
    // Change \\ to / for windows support
    runtimeDirs: {
      node: [__dirname.replace(/\\/g, '/'), '../', '../', 'client', 'runtime'].join('/'),
      edge: [__dirname.replace(/\\/g, '/'), '../', '../', 'client', 'runtime', 'edge'].join('/'),
    },
    projectRoot: '.',
    dataProxy: !!process.env.DATA_PROXY,
  })

  return require(outputDir)
}

export async function setupTestSuiteDatabase(schemaPath: string) {
  const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
  await DbPush.new().parse(['--schema', schemaPath, '--force-reset', '--skip-generate'])
  consoleInfoMock.mockRestore()
}

export function setupTestSuiteDbURI(uri: string, uuid: string) {
  const uriRegex = /(\w+:\/\/\w+:\w+@\w+:\d+\/)((?:\w|-)+)(.*)/g
  const newURI = uri.replace(uriRegex, `$1$2${uuid}$3`)
  return newURI
}
