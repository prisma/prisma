import { getPlatform } from '@prisma/get-platform'
import { getConfig, getDMMF } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import { generateClient } from '../generation/generateClient'

export interface GenerateInFolderOptions {
  projectDir: string
  useLocalRuntime?: boolean
  transpile?: boolean
}

export async function generateInFolder({
  projectDir,
  useLocalRuntime = false,
  transpile = true,
}: GenerateInFolderOptions): Promise<number> {
  const before = performance.now()
  if (!projectDir) {
    throw new Error(`Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`)
  }
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }
  const schemaPath = getSchemaPath(projectDir)
  const datamodel = fs.readFileSync(schemaPath, 'utf-8')

  const dmmf = await getDMMF({ datamodel })
  const config = await getConfig({ datamodel })

  const outputDir = path.join(projectDir, '@generated/photon')

  const platform = await getPlatform()

  await generateClient({
    binaryPaths: {
      queryEngine: {
        [platform]: path.join(__dirname, `../../query-engine-${platform}${platform === 'windows' ? '.exe' : ''}`),
      },
    },
    datamodel,
    dmmf,
    ...config,
    outputDir,
    schemaDir: path.dirname(schemaPath),
    runtimePath: useLocalRuntime ? path.relative(outputDir, path.join(__dirname, '../runtime')) : undefined,
    transpile,
  })

  const after = performance.now()
  return after - before
}

function getSchemaPath(projectDir: string) {
  if (fs.existsSync(path.join(projectDir, 'schema.prisma'))) {
    return path.join(projectDir, 'schema.prisma')
  }
  if (fs.existsSync(path.join(projectDir, 'prisma/schema.prisma'))) {
    return path.join(projectDir, 'prisma/schema.prisma')
  }
  throw new Error(`Could not find any schema.prisma in ${projectDir} or sub directories.`)
}
