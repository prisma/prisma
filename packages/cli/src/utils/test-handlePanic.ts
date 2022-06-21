import { handlePanic, IntrospectionEngine } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

async function main() {
  const packageJsonVersion = '0.0.0'
  const engineVersion = 'prismaEngineVersionHash'
  const command = 'something-test'

  try {
    const dirPath = path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql')

    process.chdir(dirPath)

    const schemaPath = path.join(dirPath, 'schema.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    const engine = new IntrospectionEngine({
      cwd: dirPath,
    })

    await engine.introspect(schema, false)
    await engine.debugPanic()
  } catch (err) {
    console.debug({ err })

    handlePanic(err, packageJsonVersion, engineVersion, command)
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
