import mkdir from 'make-dir'
import { stdin } from 'mock-stdin'
import { join, resolve } from 'path'
import prompt from 'prompts'
import stripAnsi from 'strip-ansi'
import tempy from 'tempy'

import { ErrorArea, jestConsoleContext, jestContext, RustPanic } from '..'
import * as sendPanicUtils from '../sendPanic'
import * as githubUtils from '../utils/getGitHubIssueUrl'
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

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('handlePanic', () => {
  // testing with env https://stackoverflow.com/a/48042799/1345244
  const OLD_ENV = process.env

  beforeEach(async () => {
    jest.resetModules() // most important - it clears the cache
    process.env = { ...OLD_ENV, GITHUB_ACTIONS: 'true' } // make a copy and simulate CI environment
    process.cwd = () => testRootDir
    await mkdir(testRootDir)
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
  const engineVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'
  const command = 'something-test'

  // Only works locally (not in CI)
  it.skip('ask to submit the panic error in interactive mode', async () => {
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }

    setTimeout(() => sendKeystrokes(io).then(), 5)

    try {
      await handlePanic(error, packageJsonVersion, engineVersion, command)
    } catch (e) {
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }

    console.log = oldConsoleLog
    expect(stripAnsi(logs.join('\n'))).toMatchSnapshot()
  })

  it('no interactive mode in CI', async () => {
    try {
      await handlePanic(error, packageJsonVersion, engineVersion, command)
    } catch (error) {
      error.schemaPath = 'Some Schema Path'
      expect(error).toMatchInlineSnapshot(`[Error: Some error message!]`)
      expect(JSON.stringify(error)).toMatchInlineSnapshot(
        `"{"__typename":"RustPanic","rustStack":"","area":"LIFT_CLI","schemaPath":"Some Schema Path"}"`,
      )
    }
  })

  it('when sendPanic fails, the user should be alerted by a reportFailedMessage', async () => {
    const cliVersion = 'test-cli-version'
    const engineVersion = 'test-engine-version'
    const rustStackTrace = 'test-rustStack'
    const command = 'test-command'
    const sendPanicTag = 'send-panic-failed'

    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    const spySendPanic = jest
      .spyOn(sendPanicUtils, 'sendPanic')
      .mockImplementation(() => Promise.reject(new Error(sendPanicTag)))
      .mockName('mock-sendPanic')

    const spyWouldYouLikeToCreateANewIssue = jest
      .spyOn(githubUtils, 'wouldYouLikeToCreateANewIssue')
      .mockImplementation(() => Promise.resolve())
      .mockName('mock-wouldYouLikeToCreateANewIssue')

    const rustPanic = new RustPanic(
      'test-message',
      rustStackTrace,
      'test-request',
      ErrorArea.INTROSPECTION_CLI, // area
      undefined, // schemaPath
      undefined, // schema
      undefined, // introspectionUrl
    )

    prompt.inject(['y']) // submit report
    await handlePanic(rustPanic, cliVersion, engineVersion, command)

    expect(spySendPanic).toHaveBeenCalledTimes(1)
    expect(spyWouldYouLikeToCreateANewIssue).toHaveBeenCalledTimes(1)
    expect(stripAnsi(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(stripAnsi(ctx.mocked['console.error'].mock.calls.join('\n'))).toMatch(
      new RegExp(`^Error report submission failed due to:?`),
    )
    expect(mockExit).toHaveBeenCalledWith(1)
    spySendPanic.mockRestore()
  })
})
