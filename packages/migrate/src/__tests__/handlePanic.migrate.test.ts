import { ErrorArea, handlePanic, isCi, RustPanic } from '@prisma/internals'
import fs from 'fs'
import { ensureDir } from 'fs-extra'
import { stdin } from 'mock-stdin'
import { dirname, join, resolve } from 'path'
import prompt from 'prompts'
import stripAnsi from 'strip-ansi'
import dedent from 'strip-indent'
import tempy from 'tempy'
import { promisify } from 'util'

import { Migrate } from '../Migrate'
import CaptureStdout from './__helpers__/captureStdout'

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

// eslint-disable-next-line @typescript-eslint/unbound-method
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
    await ensureDir(dirname(filepath))
    await writeFile(filepath, dedent(files[name]))
  }
  // return the test path
  return root
}
// create a temporary set of files

describe('handlePanic migrate', () => {
  // testing with env https://stackoverflow.com/a/48042799/1345244
  const OLD_ENV = process.env

  beforeEach(async () => {
    jest.resetModules() // most important - it clears the cache
    process.env = { ...OLD_ENV } // make a copy
    process.cwd = () => testRootDir
    await ensureDir(testRootDir)
  })
  afterEach(() => {
    process.cwd = oldProcessCwd
    // await del(testRootDir, { force: true }) // Need force: true because `del` does not delete dirs outside the CWD
  })
  let io
  beforeAll(() => (io = stdin()))
  afterAll(() => {
    process.env = OLD_ENV // restore old env
    io.restore()
  })

  const packageJsonVersion = '0.0.0'
  const enginesVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'
  const command = 'something-test'

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
      await migrate.createMigration({
        migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
        migrationName: 'setup',
        draft: false,
        prismaSchema: migrate.getPrismaSchema(),
      })
    } catch (err) {
      // No to send error report
      setTimeout(() => sendKeystrokes(io).then(), 5)
      // No to create new issue
      setTimeout(() => sendKeystrokes(io).then(), 5)
      // This allows this test to be run in the CI
      const getDatabaseVersionSafe = () => Promise.resolve(undefined)
      try {
        await handlePanic({
          error: err,
          cliVersion: packageJsonVersion,
          enginesVersion,
          command,
          getDatabaseVersionSafe,
        })
      } catch (err) {
        error = err
      }
    }
    // We use prompts.inject() for testing in our CI
    if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
      expect(error).toMatchInlineSnapshot(`
        Error in migration engine.
        Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic

        Please create an issue with your \`schema.prisma\` at
        https://github.com/prisma/prisma/issues/new

      `)
    } else {
      const output = captureStdout.getCapturedText()
      expect(stripAnsi(output.join('\n'))).toMatchInlineSnapshot(``)
    }
    captureStdout.stopCapture()
  })

  it('engine panic no interactive mode in CI', async () => {
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
      await migrate.createMigration({
        migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
        migrationName: 'setup',
        draft: false,
        prismaSchema: migrate.getPrismaSchema(),
      })
    } catch (e) {
      const error = e as RustPanic

      expect(error).toMatchSnapshot()
      expect(JSON.parse(JSON.stringify(error))).toMatchObject({
        area: 'LIFT_CLI',
        schemaPath,
      })
      expect(error.message).toContain('This is the debugPanic artificial panic')

      const isWindows = ['win32'].includes(process.platform)
      if (!isWindows) {
        expect(error.rustStack).toContain('std::panicking::')
      }
    }
  })
})
