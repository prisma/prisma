import { RustPanic, ErrorArea } from '@prisma/sdk'
import { handlePanic } from '@prisma/migrate'
import path from 'path'
import { Introspect } from '../Introspect'

async function main() {
  // process.env.GITHUB_ACTIONS = 'maybe'

  // const error = new RustPanic(
  //   'Some error message!\n'.repeat(23),
  //   '',
  //   undefined,
  //   ErrorArea.INTROSPECTION_CLI,
  //   path.resolve(path.join('fixtures', 'blog', 'prisma', 'schema.prisma')),
  // )

  const packageJsonVersion = '0.0.0'
  const prismaVersion = 'prismaVersionHash'

  // await handlePanic(error, packageJsonVersion, prismaVersion)
  //   .catch((e) => {
  //     console.log(e)
  //   })
  //   .finally(() => {
  //     process.exit(1)
  //   })

  try {
    // process.chdir(path.join(__dirname, '..', '__tests__', 'fixtures', 'sqlite'))
    process.chdir(
      path.join(
        __dirname,
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'postgresql',
      ),
    )
    const introspect = new Introspect()

    await introspect.parse(['--print'])
  } catch (err) {
    console.debug('YEs')
    console.debug({ err })

    handlePanic(err, packageJsonVersion, prismaVersion)
      .catch((e) => {
        console.error('Error: ' + e.stack)
        console.error('Error: ' + e.message)
      })
      .finally(() => {
        process.exit(1)
      })
  }
}

main()
