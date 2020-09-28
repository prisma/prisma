import { ErrorArea, RustPanic } from '@prisma/sdk'
import fs from 'fs'
import mkdir from 'make-dir'
import { stdin } from 'mock-stdin'
import { dirname, join, resolve } from 'path'
import stripAnsi from 'strip-ansi'
import dedent from 'strip-indent'
import tempy from 'tempy'
import { promisify } from 'util'
import { Migrate } from '../Migrate'
import { handlePanic } from '../utils/handlePanic'
import CaptureStdout from './__helpers__/captureStdout'
import isCi from 'is-ci'

const keys = {
  up: '\x1B\x5B\x41',
  down: '\x1B\x5B\x42',
  enter: '\x0D',
  space: '\x20',
}
const sendKeystrokes = async (io) => {
  io.send(keys.down)
  io.send(keys.enter)
  await delay(10)
}
// helper function for timing
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) // Mock stdin so we can send messages to the CLI

const writeFile = promisify(fs.writeFile)
const testRootDir = tempy.directory()

const oldProcessCwd = process.cwd
// create a temporary set of files
async function writeFiles(
  root: string,
  files: {
    [name: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
): Promise<string> {
  for (const name in files) {
    const filepath = join(root, name)
    await mkdir(dirname(filepath))
    await writeFile(filepath, dedent(files[name]))
  }
  // return the test path
  return root
}
// create a temporary set of files

describe('handlePanic', () => {
  // testing with env https://stackoverflow.com/a/48042799/1345244
  const OLD_ENV = process.env

  beforeEach(async () => {
    jest.resetModules() // most important - it clears the cache
    process.env = { ...OLD_ENV } // make a copy
    process.cwd = () => testRootDir
    await mkdir(testRootDir)
  })
  afterEach(async () => {
    process.cwd = oldProcessCwd
    // await del(testRootDir, { force: true }) // Need force: true because `del` does not delete dirs outside the CWD
  })
  let io
  beforeAll(() => (io = stdin()))
  afterAll(() => {
    process.env = OLD_ENV // restore old env
    io.restore()
  })

  const error = new RustPanic(
    'Some error message!',
    '',
    undefined,
    ErrorArea.LIFT_CLI,
    resolve(join('fixtures', 'blog', 'prisma', 'schema.prisma')),
  )
  const packageJsonVersion = '0.0.0'
  const prismaVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'

  // Only works locally (not in CI)
  it.skip('ask to submit the panic error in interactive mode', async () => {
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }

    setTimeout(() => sendKeystrokes(io).then(), 5)

    try {
      await handlePanic(error, packageJsonVersion, prismaVersion)
    } catch (e) {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }

    console.log = oldConsoleLog
    expect(stripAnsi(logs.join('\n'))).toMatchSnapshot()
  })

  it('no interactive mode in CI', async () => {
    process.env.GITHUB_ACTIONS = 'maybe'
    try {
      await handlePanic(error, packageJsonVersion, prismaVersion)
    } catch (error) {
      error.schemaPath = 'Some Schema Path'
      expect(error).toMatchInlineSnapshot(`[Error: Some error message!]`)
      expect(JSON.stringify(error)).toMatchInlineSnapshot(
        `"{\\"rustStack\\":\\"\\",\\"schemaPath\\":\\"Some Schema Path\\",\\"area\\":\\"LIFT_CLI\\"}"`,
      )
    }
  })

  it('test interactive engine panic', async () => {
    process.env.FORCE_PANIC_MIGRATION_ENGINE = '1'
    const captureStdout = new CaptureStdout()
    const files = {
      'schema.prisma': `
        datasource my_db {
          provider = "sqlite"
          url = "file:./db/db_file.db"
          default = true
        }

        model User {
          id Int @id
        }
      `,
      'db/.keep': ``,
    }
    const schemaPath = join(testRootDir, Object.keys(files)[0])
    await writeFiles(testRootDir, files)

    captureStdout.startCapture()

    let error
    try {
      const migrate = new Migrate(schemaPath)
      await migrate.createMigration('setup')
    } catch (err) {
      // No to send error report
      setTimeout(() => sendKeystrokes(io).then(), 5)
      // No to create new issue
      setTimeout(() => sendKeystrokes(io).then(), 5)
      // This allows this test to be run in the CI
      try {
        await handlePanic(err, packageJsonVersion, prismaVersion)
      } catch (err) {
        error = err
      }
    }
    if (!process.stdout.isTTY || isCi || process.env.GITHUB_ACTIONS) {
      expect(error).toMatchInlineSnapshot(`
      [Error: Error in migration engine.
      Reason: [/rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libstd/macros.rs:13:23] This is the debugPanic artificial panic

      Please create an issue in the migrate repo with
      your \`schema.prisma\` and the prisma command you tried to use 🙏:
      https://github.com/prisma/migrate/issues/new
      ]
    `)
    } else {
      const output = captureStdout.getCapturedText()
      expect(stripAnsi(output.join('\n'))).toMatchInlineSnapshot(`
      "
        console.log    Oops, an unexpected error occured!    Error in migration engine.    Reason: [/rustc/04488afe34512aa4c33566eb16d8c912a3ae04f9/src/libstd/macros.rs:13:23] This is the debugPanic artificial panic        Please create an issue in the migrate repo with    your \`schema.prisma\` and the prisma command you tried to use 🙏:    https://github.com/prisma/migrate/issues/new            Please help us improve Prisma by submitting an error report.    Error reports never contain personal or other sensitive information.    Learn more: https://pris.ly/d/telemetry      at panicDialog (src/utils/handlePanic.ts:29:11)

      ? Submit error report › - Use arrow-keys. Return to submit.❯   Yes - Send error report once    No

      ? Submit error report › - Use arrow-keys. Return to submit.    Yes❯   No - Don't send error report

      ✔ Submit error report › No



      ? Would you like to create a Github issue? › - Use arrow-keys. Return to submit.❯   Yes - Create a new GitHub issue    No

      ? Would you like to create a Github issue? › - Use arrow-keys. Return to submit.    Yes❯   No - Don't create a new GitHub issue

      ✔ Would you like to create a Github issue? › No

      "
    `)
    }
    captureStdout.stopCapture()
  })

  it('engine panic no interactive mode in CI', async () => {
    process.env.GITHUB_ACTIONS = 'maybe'
    process.env.FORCE_PANIC_MIGRATION_ENGINE = '1'

    const files = {
      'schema.prisma': `
        datasource my_db {
          provider = "sqlite"
          url = "file:./db/db_file.db"
          default = true
        }

        model User {
          id Int @id
        }
      `,
      'db/.keep': ``,
    }
    const schemaPath = join(testRootDir, Object.keys(files)[0])
    await writeFiles(testRootDir, files)

    try {
      const migrate = new Migrate(schemaPath)
      await migrate.createMigration('setup')
    } catch (err) {
      expect(error).toMatchInlineSnapshot(`[Error: Some error message!]`)
      expect(JSON.stringify(error)).toMatchInlineSnapshot(
        `"{\\"rustStack\\":\\"\\",\\"schemaPath\\":\\"Some Schema Path\\",\\"area\\":\\"LIFT_CLI\\"}"`,
      )
    }
  })
})
