import { generateClient } from '@prisma/client-generator-js'
import { getConfig, getDMMF, parseEnvValue } from '@prisma/internals'
import fs from 'fs/promises'
import path from 'path'

import { MemoryTestDir } from './MemoryTestDir'

export async function generateMemoryTestClient(testDir: MemoryTestDir) {
  const schema = await fs.readFile(testDir.schemaFilePath, 'utf8')
  const dmmf = await getDMMF({ datamodel: schema })
  const config = await getConfig({
    datamodel: [[testDir.schemaFilePath, schema]],
  })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')!

  const runtimePath = path.join(__dirname, '../../../runtime')

  await generateClient({
    datamodel: schema,
    schemaPath: testDir.schemaFilePath,
    binaryPaths: {},
    datasources: config.datasources,
    outputDir: path.join(testDir.generatedDir, 'node_modules/@prisma/client'),
    copyRuntime: false,
    dmmf: dmmf,
    generator: generator,
    engineVersion: '0000000000000000000000000000000000000000',
    clientVersion: '0.0.0',
    testMode: true,
    activeProvider: config.datasources[0].activeProvider,
    runtimeBase: runtimePath,
    runtimeSourcePath: runtimePath,
    compilerBuild: 'fast',
  })
}
