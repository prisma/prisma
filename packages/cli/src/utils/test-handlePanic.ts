import { handlePanic } from '@prisma/internals'
import { MigrateEngine } from '@prisma/migrate'
import fs from 'fs'
import path from 'path'

async function main() {
  const packageJsonVersion = '0.0.0'
  const enginesVersion = 'prismaEngineVersionHash'
  const command = 'something-test'

  try {
    const dirPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql')

    process.chdir(dirPath)

    const schemaPath = path.join(dirPath, 'schema.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    const engine = new MigrateEngine({
      projectDir: dirPath,
    })

    await engine.introspect({ schema, force: false })
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
