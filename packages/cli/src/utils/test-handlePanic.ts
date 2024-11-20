import { getSchema, handlePanic, loadEnvFile, toSchemasContainer } from '@prisma/internals'
import { SchemaEngine } from '@prisma/migrate'
import path from 'path'

async function main() {
  const packageJsonVersion = '0.0.0'
  const enginesVersion = 'prismaEngineVersionHash'
  const command = 'something-test'

  try {
    const dirPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql')

    process.chdir(dirPath)

    const schemaPath = path.join(dirPath, 'schema.prisma')
    const schemas = await getSchema(schemaPath)
    const parsedEnv = await loadEnvFile({ schemaPath })

    const engine = new SchemaEngine({ env: parsedEnv })

    await engine.introspect({ schema: toSchemasContainer(schemas), baseDirectoryPath: dirPath, force: false })
    await engine.debugPanic()
  } catch (err) {
    console.debug({ err })

    const getDatabaseVersionSafe = () => Promise.resolve(undefined)
    handlePanic({
      error: err,
      cliVersion: packageJsonVersion,
      enginesVersion,
      command,
      getDatabaseVersionSafe,
    })
      .catch((e) => {
        console.error('Error: ' + e.stack)
        console.error('Error: ' + e.message)
      })
      .finally(() => {
        process.exit(1)
      })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
