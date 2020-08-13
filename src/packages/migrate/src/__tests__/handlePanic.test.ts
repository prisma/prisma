import assert from 'assert'
import { RustPanic, ErrorArea } from '@prisma/sdk'
import { handlePanic } from '../utils/handlePanic'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { stdin } from 'mock-stdin'

describe('handlePanic', () => {
  const keys = {
    up: '\x1B\x5B\x41',
    down: '\x1B\x5B\x42',
    enter: '\x0D',
    space: '\x20',
  }
  // helper function for timing
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) // Mock stdin so we can send messages to the CLI

  // testing with env https://stackoverflow.com/a/48042799/1345244
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules() // most important - it clears the cache
    process.env = { ...OLD_ENV } // make a copy
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
    path.resolve(path.join('fixtures', 'blog', 'prisma', 'schema.prisma')),
  )
  const packageJsonVersion = '0.0.0'
  const prismaVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'

  it('ask to submit the panic error in interactive mode', async () => {
    const oldConsoleLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(...args)
    }

    const sendKeystrokes = async () => {
      io.send(keys.down)
      io.send(keys.enter)
      await delay(10)
    }
    setTimeout(() => sendKeystrokes().then(), 5)

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
})
