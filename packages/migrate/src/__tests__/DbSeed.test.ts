import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import execa from 'execa'

import { DbSeed } from '../commands/DbSeed'
import { CaptureStdout } from '../utils/captureStdout'
import { defaultTestConfig } from './__helpers__/prismaConfig'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const captureStdout = new CaptureStdout()

beforeEach(() => {
  captureStdout.startCapture()
})

afterEach(() => {
  captureStdout.clearCaptureText()
})

afterAll(() => {
  captureStdout.stopCapture()
})

describe('seed', () => {
  it('seed.js', async () => {
    ctx.fixture('seed-sqlite-js')

    const result = DbSeed.new().parse([], defaultTestConfig())
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Running seed command \`node prisma/seed.js\` ...
      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('seed.js with -- extra args should succeed', async () => {
    ctx.fixture('seed-sqlite-js-extra-args')

    const result = DbSeed.new().parse(
      ['--', '--my-custom-arg-from-cli-1', 'my-value', '--my-custom-arg-from-cli-2=my-value', '-z'],
      defaultTestConfig(),
    )
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Running seed command \`node prisma/seed.js --my-custom-arg-from-config-1 my-value --my-custom-arg-from-config-2=my-value -y --my-custom-arg-from-cli-1 my-value --my-custom-arg-from-cli-2=my-value -z\` ...
      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('seed.js with extra args but missing -- should throw with specific message', async () => {
    ctx.fixture('seed-sqlite-js-extra-args')

    const result = DbSeed.new().parse(['--my-custom-arg-from-cli=my-value', '-z'], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(`
      "unknown or unexpected option: --my-custom-arg-from-cli
      Did you mean to pass these as arguments to your seed script? If so, add a -- separator before them:
      $ prisma db seed -- --arg1 value1 --arg2 value2"
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('one broken seed.js file', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    ctx.fixture('seed-sqlite-js')
    ctx.fs.write('prisma/seed.js', 'BROKEN_CODE_SHOULD_ERROR;')

    const result = DbSeed.new().parse([], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 1"`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Running seed command \`node prisma/seed.js\` ...
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join()).toContain('An error occurred while running the seed command:')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('seed.ts', async () => {
    ctx.fixture('seed-sqlite-ts')

    const result = DbSeed.new().parse([], defaultTestConfig())
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Running seed command \`ts-node prisma/seed.ts\` ...
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  }, 10_000)

  it('seed.ts - ESM', async () => {
    ctx.fixture('seed-sqlite-ts-esm')

    // Needs ts-node to be installed
    await execa.command('npm i')

    const result = DbSeed.new().parse([], defaultTestConfig())
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Running seed command \`node --loader ts-node/esm prisma/seed.ts\` ...
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    // "high" number since `npm install` can sometimes be very slow
  }, 60_000)

  it('seed.sh', async () => {
    ctx.fixture('seed-sqlite-sh')

    const result = DbSeed.new().parse([], defaultTestConfig())
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Running seed command \`./prisma/seed.sh\` ...
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
