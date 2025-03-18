import { ErrorArea, handlePanic, RustPanic } from '@prisma/internals'

async function main() {
  const error = new RustPanic('Some error message!\n'.repeat(23), '', undefined, ErrorArea.LIFT_CLI)

  const packageJsonVersion = '0.0.0'
  const enginesVersion = 'prismaEngineVersionHash'
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
