import { performance } from 'perf_hooks'
import path from 'path'
import fs from 'fs'
import { generateClient } from '../src/generation/generateClient'
import { getDMMF, getConfig } from '@prisma/sdk'

async function main() {
  const before = performance.now()
  const projectDir = process.argv[2]
  if (!projectDir) {
    throw new Error(`Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`)
  }
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }
  const schemaPath = getSchemaPath(process.argv[2])
  const datamodel = fs.readFileSync(schemaPath, 'utf-8')

  const dmmf = await getDMMF({ datamodel })
  const config = await getConfig({ datamodel })

  await generateClient({
    binaryPaths: {
      queryEngine: {
        darwin: path.join(__dirname, '../query-engine-darwin'),
      },
    },
    datamodel,
    dmmf,
    ...config,
    outputDir: path.join(projectDir, '@generated/photon'),
    schemaDir: path.dirname(schemaPath),
    runtimePath: '../../../../src/runtime',
  })

  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

function getSchemaPath(projectDir: string) {
  if (fs.existsSync(path.join(projectDir, 'schema.prisma'))) {
    return path.join(projectDir, 'schema.prisma')
  }
  if (fs.existsSync(path.join(projectDir, 'prisma/schema.prisma'))) {
    return path.join(projectDir, 'prisma/schema.prisma')
  }
  throw new Error(`Could not find any schema.prisma in ${projectDir} or sub directories.`)
}
