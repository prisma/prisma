import { ErrorArea, handlePanic, RustPanic } from '@prisma/internals'
import path from 'path'

async function main() {
  const error = new RustPanic(
    'Some error message!\n'.repeat(23),
    '',
    undefined,
    ErrorArea.LIFT_CLI,
    path.resolve(path.join('fixtures', 'blog', 'prisma', 'schema.prisma')),
  )

  const packageJsonVersion = '0.0.0'
  const enginesVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'
  const getDatabaseVersionSafe = () => Promise.resolve(undefined)

  await handlePanic({
    error,
    cliVersion: packageJsonVersion,
    enginesVersion,
    command: 'something-test',
    getDatabaseVersionSafe,
  })
    .catch((e) => {
      console.log(e)
    })
    .finally(() => {
      process.exit(1)
    })
}

void main()
