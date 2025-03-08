import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { ensureDir } from 'fs-extra'
import { stdin } from 'mock-stdin'
import { join, resolve } from 'node:path'
import prompt from 'prompts'
import stripAnsi from 'strip-ansi'
import tempy from 'tempy'

import { ErrorArea, RustPanic } from '..'
import { sendPanic } from '../sendPanic'
import { wouldYouLikeToCreateANewIssue } from '../utils/getGitHubIssueUrl'
import { handlePanic } from '../utils/handlePanic'

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

const testRootDir = tempy.directory()

// eslint-disable-next-line @typescript-eslint/unbound-method
const oldProcessCwd = process.cwd

const sendPanicTag = 'send-panic-failed'

jest.mock('../sendPanic', () => ({
  ...jest.requireActual('../sendPanic'),
  sendPanic: jest.fn().mockImplementation(() => Promise.reject(new Error(sendPanicTag))),
}))

jest.mock('../utils/getGitHubIssueUrl', () => ({
  ...jest.requireActual('../utils/getGitHubIssueUrl'),
  wouldYouLikeToCreateANewIssue: jest.fn().mockImplementation(() => Promise.resolve()),
}))

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('handlePanic', () => {
  // testing with env https://stackoverflow.com/a/48042799/1345244
  const OLD_ENV = process.env

  // mock for retrieving the database version
  const getDatabaseVersionSafe = () => Promise.resolve(undefined)

  beforeEach(async () => {
    jest.resetModules() // most important - it clears the cache
    jest.clearAllMocks()

    process.env = { ...OLD_ENV, GITHUB_ACTIONS: 'true' } // make a copy and simulate CI environment
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

  const error = new RustPanic(
    'Some error message!',
    '',
    undefined,
    ErrorArea.LIFT_CLI,
    resolve(join('fixtures', 'blog', 'prisma', 'schema.prisma')),
  )
  const packageJsonVersion = '0.0.0'
  const enginesVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'
  const command = 'something-test'

  // Only works locally (not in CI)
  it('ask to submit the panic error in interactive mode', async () => {
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }

    setTimeout(() => sendKeystrokes(io).then(), 5)

    try {
      await handlePanic({
        error,
        cliVersion: packageJsonVersion,
        enginesVersion: enginesVersion,
        command,
        getDatabaseVersionSafe,
      })
    } catch (e) {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }

    console.log = oldConsoleLog
    expect(stripAnsi(logs.join('\n'))).toMatchSnapshot()
  })

  it('no interactive mode in CI', async () => {
    try {
      await handlePanic({
        error,
        cliVersion: packageJsonVersion,
        enginesVersion,
        command,
        getDatabaseVersionSafe,
      })
    } catch (error) {
      error.schemaPath = 'Some Schema Path'
      expect(error).toMatchInlineSnapshot('[RustPanic: Some error message!]')
      expect(JSON.stringify(error)).toMatchInlineSnapshot(
        `"{"__typename":"RustPanic","rustStack":"","area":"LIFT_CLI","schemaPath":"Some Schema Path","name":"RustPanic"}"`,
      )
    }
  })

  it('when sendPanic fails, the user should be alerted by a reportFailedMessage', async () => {
    const cliVersion = 'test-cli-version'
    const enginesVersion = 'test-engine-version'
    const rustStackTrace = 'test-rustStack'
    const command = 'test-command'

    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.LIFT_CLI, // area
      undefined, // schemaPath
      undefined, // schema
      undefined, // introspectionUrl
    )

    prompt.inject(['y']) // submit report
    await handlePanic({
      error: rustPanic,
      cliVersion,
      enginesVersion,
      command,
      getDatabaseVersionSafe,
    })

    expect(sendPanic).toHaveBeenCalledTimes(1)
    expect(wouldYouLikeToCreateANewIssue).toHaveBeenCalledTimes(1)
    expect(stripAnsi(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(stripAnsi(ctx.mocked['console.error'].mock.calls.join('\n'))).toMatch(
      /^Error report submission failed due to:?/,
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
