import type { ExecaChildProcess } from 'execa'
import execa from 'execa'
import fs from 'fs-jetpack'
import type { FSJetpack } from 'fs-jetpack/types'
import path from 'path'
import tempy from 'tempy'

/**
 * Base test context.
 */
type BaseContext = {
  tmpDir: string
  fs: FSJetpack
  mocked: {
    cwd: string
  }
  /**
   * Set up the temporary directory based on the contents of some fixture.
   */
  fixture: (name: string) => void
  /**
   * Spawn the Prisma cli using the temporary directory as the CWD.
   *
   * @remarks
   *
   * For this to work the source must be built
   */
  cli: (...input: string[]) => ExecaChildProcess<string>
}

/**
 * Create test context to use in tests. Provides the following:
 *
 * - A temporary directory
 * - an fs-jetpack instance bound to the temporary directory
 * - Mocked process.cwd via Node process.chdir
 * - Fixture loader for bootstrapping the temporary directory with content
 */
export const jestContext = {
  new: function (ctx: BaseContext = {} as any) {
    const c = ctx as BaseContext

    beforeEach(() => {
      const originalCwd = process.cwd()

      c.tmpDir = tempy.directory()
      c.fs = fs.cwd(c.tmpDir)
      c.fixture = (name: string) => {
        // copy the specific fixture directory in isolated tmp directory
        c.fs.copy(path.join(originalCwd, 'src', '__tests__', 'fixtures', name), '.', {
          overwrite: true,
        })
        // symlink to local client version in tmp dir
        c.fs.symlink(path.join(originalCwd, '..', 'client'), path.join(c.fs.cwd(), 'node_modules', '@prisma', 'client'))
      }
      c.mocked = c.mocked ?? {
        cwd: process.cwd(),
      }
      c.cli = (...input) => {
        return execa.node(path.join(originalCwd, '../cli/build/index.js'), input, {
          cwd: c.fs.cwd(),
          stdio: 'pipe',
          all: true,
        })
      }
      process.chdir(c.tmpDir)
    })

    afterEach(() => {
      process.chdir(c.mocked.cwd)
    })

    return factory(ctx)
  },
}

/**
 * Factory for creating a context contributor possibly configured in some special way.
 */
type ContextContributorFactory<Settings, Context, NewContext> = Settings extends {}
  ? () => ContextContributor<Context, NewContext>
  : (settings: Settings) => ContextContributor<Context, NewContext>

/**
 * A function that provides additional test context.
 */
type ContextContributor<Context, NewContext> = (ctx: Context) => Context & NewContext

/**
 * Main context builder API that permits recursively building up context.
 */

function factory<Context>(ctx: Context) {
  return {
    add<NewContext>(contextContributor: ContextContributor<Context, NewContext>) {
      const newCtx = contextContributor(ctx)
      return factory<Context & NewContext>(newCtx)
    },
    assemble(): Context {
      return ctx
    },
  }
}

/**
 * Test context contributor. Mocks console.error with a Jest spy before each test.
 */

type ConsoleContext = {
  mocked: {
    'console.error': jest.SpyInstance
    'console.log': jest.SpyInstance
    'console.info': jest.SpyInstance
    'console.warn': jest.SpyInstance
  }
}

export const jestConsoleContext: ContextContributorFactory<{}, BaseContext, ConsoleContext> = () => (c) => {
  const ctx = c as BaseContext & ConsoleContext

  beforeEach(() => {
    ctx.mocked['console.error'] = jest.spyOn(console, 'error').mockImplementation(() => {})
    ctx.mocked['console.log'] = jest.spyOn(console, 'log').mockImplementation(() => {})
    ctx.mocked['console.info'] = jest.spyOn(console, 'info').mockImplementation(() => {})
    ctx.mocked['console.warn'] = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    ctx.mocked['console.error'].mockRestore()
    ctx.mocked['console.log'].mockRestore()
    ctx.mocked['console.info'].mockRestore()
    ctx.mocked['console.warn'].mockRestore()
  })

  return ctx
}

/**
 * Test context contributor. Mocks process.std(out|err).write with a Jest spy before each test.
 */

type ProcessContext = {
  mocked: {
    'process.stderr.write': jest.SpyInstance
    'process.stdout.write': jest.SpyInstance
  }
}

export const jestProcessContext: ContextContributorFactory<{}, BaseContext, ProcessContext> = () => (c) => {
  const ctx = c as BaseContext & ProcessContext

  beforeEach(() => {
    ctx.mocked['process.stderr.write'] = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation((message: string | Uint8Array) => true)
    ctx.mocked['process.stdout.write'] = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((message: string | Uint8Array) => true)
  })

  afterEach(() => {
    ctx.mocked['process.stderr.write'].mockRestore()
    ctx.mocked['process.stdout.write'].mockRestore()
  })

  return ctx
}
