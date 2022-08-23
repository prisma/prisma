import { getConfig, parseEnvValue } from '@prisma/internals'
import fs from 'fs/promises'
import path from 'path'

import { generateClient } from '../../../src/generation/generateClient'
import { getDMMF } from '../../../src/generation/getDMMF'
import { MemoryTestDir } from './MemoryTestDir'

export async function generateMemoryTestClient(testDir: MemoryTestDir) {
  const schema = await fs.readFile(testDir.schemaFilePath, 'utf8')
  const dmmf = await getDMMF({ datamodel: schema, datamodelPath: testDir.schemaFilePath })
  const config = await getConfig({ datamodel: schema, datamodelPath: testDir.schemaFilePath })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await generateClient({
    datamodel: schema,
    schemaPath: testDir.schemaFilePath,
    binaryPaths: { libqueryEngine: {}, queryEngine: {} },
    datasources: config.datasources,
    outputDir: path.join(testDir.generatedDir, 'node_modules/@prisma/client'),
    copyRuntime: false,
    dmmf: dmmf,
    generator: generator,
    engineVersion: '0000000000000000000000000000000000000000',
    clientVersion: '0.0.0',
    transpile: false,
    testMode: true,
    activeProvider: config.datasources[0].activeProvider,
    // Change \\ to / for windows support
    runtimeDirs: {
      node: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime'].join('/'),
      edge: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime', 'edge'].join('/'),
    },
    projectRoot: testDir.basePath,
    dataProxy: !!process.env.DATA_PROXY,
  })
}
