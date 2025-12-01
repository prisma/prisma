import { execaCommand } from 'execa'

import { DbSeed } from '../commands/DbSeed'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

describe('seed', () => {
  describe('from prisma.config.ts', () => {
    it('prints helpful message when no seed is configured', async () => {
      ctx.fixture('prisma-config')

      const result = DbSeed.new().parse([], await ctx.config())

      await expect(result).resolves.toContain('No seed command configured')
      await expect(result).resolves.toContain('migrations')
      await expect(result).resolves.toContain('seed')
      await expect(result).resolves.toContain('prisma.config.ts')
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('skips deprecated package.json config', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-skips-deprecated-package-json')

      const result = DbSeed.new().parse([], await ctx.config())

      await expect(result).resolves.toContain(`The seed command has been executed.`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`node prisma/seed.js\` ...
        "
      `)

      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('seed.js', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-js')

      const result = DbSeed.new().parse([], await ctx.config())
      await expect(result).resolves.toContain(`The seed command has been executed.`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`node prisma/seed.js\` ...
        "
      `)

      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('seed.js with -- extra args should succeed', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-js-extra-args')

      const result = DbSeed.new().parse(
        ['--', '--my-custom-arg-from-cli-1', 'my-value', '--my-custom-arg-from-cli-2=my-value', '-z'],
        await ctx.config(),
      )
      await expect(result).resolves.toContain(`The seed command has been executed.`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`node prisma/seed.js --my-custom-arg-from-config-1 my-value --my-custom-arg-from-config-2=my-value -y --my-custom-arg-from-cli-1 my-value --my-custom-arg-from-cli-2=my-value -z\` ...
        "
      `)

      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('seed.js with extra args but missing -- should throw with specific message', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-js-extra-args')

      const result = DbSeed.new().parse(['--my-custom-arg-from-cli=my-value', '-z'], await ctx.config())
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

      ctx.fixture('seed-from-prisma-config/seed-sqlite-js')
      ctx.fs.write('prisma/seed.js', 'BROKEN_CODE_SHOULD_ERROR;')

      const result = DbSeed.new().parse([], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 1"`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`node prisma/seed.js\` ...
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join()).toContain(
        'An error occurred while running the seed command:',
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('seed.ts', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-ts')

      const result = DbSeed.new().parse([], await ctx.config())
      await expect(result).resolves.toContain(`The seed command has been executed.`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`ts-node prisma/seed.ts\` ...
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    }, 10_000)

    it('seed.ts - ESM', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-ts-esm')

      // Needs ts-node to be installed
      await execaCommand('npm i')

      const result = DbSeed.new().parse([], await ctx.config())
      await expect(result).resolves.toContain(`The seed command has been executed.`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`node --loader ts-node/esm prisma/seed.ts\` ...
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

      // "high" number since `npm install` can sometimes be very slow
    }, 60_000)

    it('seed.sh', async () => {
      ctx.fixture('seed-from-prisma-config/seed-sqlite-sh')

      const result = DbSeed.new().parse([], await ctx.config())
      await expect(result).resolves.toContain(`The seed command has been executed.`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Running seed command \`./prisma/seed.sh\` ...
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })
  })
})
