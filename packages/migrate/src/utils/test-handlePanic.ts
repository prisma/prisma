import { RustPanic, ErrorArea } from '@prisma/sdk'
import { handlePanic } from '../utils/handlePanic'
import path from 'path'

async function main() {
  // process.env.GITHUB_ACTIONS = 'maybe'

  const error = new RustPanic(
    'Some error message!\n'.repeat(23),
    '',
    undefined,
    ErrorArea.LIFT_CLI,
    path.resolve(path.join('fixtures', 'blog', 'prisma', 'schema.prisma')),
  )

  const packageJsonVersion = '0.0.0'
  const engineVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'

  await handlePanic(error, packageJsonVersion, engineVersion, 'something-test')
    .catch((e) => {
      console.log(e)
    })
    .finally(() => {
      process.exit(1)
    })
}

void main()
