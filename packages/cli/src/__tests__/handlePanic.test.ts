import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { canPrompt, handlePanic } from '@prisma/internals'
import { DbPull, MigrateDev } from '@prisma/migrate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('handlePanic', () => {
  // testing with env https://stackoverflow.com/a/48042799/1345244
  const OLD_ENV = process.env

  // mock for retrieving the database version
  const getDatabaseVersionSafe = () => Promise.resolve(undefined)

  beforeEach(() => {
    jest.resetModules() // most important - it clears the cache
    process.env = { ...OLD_ENV } // make a copy
  })
  afterAll(() => {
    process.env = OLD_ENV // restore old env
  })

  const packageJsonVersion = '0.0.0'
  const enginesVersion = '734ab53bd8e2cadf18b8b71cb53bf2d2bed46517'
  const command = 'something-test'

  describe('migrate', () => {
    it('no interactive mode in CI', async () => {
      expect.assertions(6)
      process.env.FORCE_PANIC_MIGRATION_ENGINE = '1'
      ctx.fixture('migration-engine-interactive')

      const migrate = new MigrateDev()

      let error: Error | undefined

      try {
        await migrate.parse(['--name', 'setup'])
      } catch (e) {
        const rustPanic = e

        expect(JSON.parse(JSON.stringify(rustPanic))).toMatchObject({
          area: 'LIFT_CLI',
        })
        expect(rustPanic).toMatchSnapshot()
        expect(rustPanic.message).toContain('This is the debugPanic artificial panic')
        expect(rustPanic.rustStack).toContain('[EXIT_PANIC]')

        const isWindows = ['win32'].includes(process.platform)
        if (!isWindows) {
          expect(rustPanic.rustStack).toContain('std::panicking::')
        }

        try {
          await handlePanic({
            error: rustPanic,
            cliVersion: packageJsonVersion,
            enginesVersion,
            command,
            getDatabaseVersionSafe,
          })
        } catch (err) {
          error = err
        }
      }

      if (!canPrompt()) {
        expect(error).toMatchInlineSnapshot(`
          Error in migration engine.
          Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic

        `)
      }
    })
  })

  describe('introspect', () => {
    it('no interactive mode in CI', async () => {
      expect.assertions(6)
      process.env.FORCE_PANIC_MIGRATION_ENGINE = '1'
      ctx.fixture('migration-engine-interactive')

      const migrate = new DbPull()

      let error: Error | undefined

      try {
        await migrate.parse(['--print'])
      } catch (e) {
        const rustPanic = e

        expect(JSON.parse(JSON.stringify(rustPanic))).toMatchObject({
          area: 'LIFT_CLI',
        })
        expect(rustPanic).toMatchSnapshot()
        expect(rustPanic.message).toContain('This is the debugPanic artificial panic')
        expect(rustPanic.rustStack).toContain('[EXIT_PANIC]')

        const isWindows = ['win32'].includes(process.platform)
        if (!isWindows) {
          expect(rustPanic.rustStack).toContain('std::panicking::')
        }

        try {
          await handlePanic({
            error: rustPanic,
            cliVersion: packageJsonVersion,
            enginesVersion,
            command,
            getDatabaseVersionSafe,
          })
        } catch (err) {
          error = err
        }
      }

      if (!canPrompt()) {
        expect(error).toMatchInlineSnapshot(`
          Error in migration engine.
          Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic

        `)
      }
    })
  })
})
