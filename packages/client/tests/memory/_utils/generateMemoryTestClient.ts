import { getConfig, getDMMF, parseEnvValue } from '@prisma/internals'
import fs from 'node:fs/promises'
import path from 'node:path'

import { generateClient } from '../../../src/generation/generateClient'
import type { MemoryTestDir } from './MemoryTestDir'

export async function generateMemoryTestClient(testDir: MemoryTestDir) {
  const schema = await fs.readFile(testDir.schemaFilePath, 'utf8')
  const dmmf = await getDMMF({ datamodel: schema, datamodelPath: testDir.schemaFilePath })
  const config = await getConfig({
    datamodel: [[testDir.schemaFilePath, schema]],
    datamodelPath: testDir.schemaFilePath,
    ignoreEnvVarErrors: false,
  })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')!

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
    testMode: true,
    activeProvider: config.datasources[0].activeProvider,
    runtimeBase: path.join(__dirname, '..', '..', '..', 'runtime'),
  })
}
