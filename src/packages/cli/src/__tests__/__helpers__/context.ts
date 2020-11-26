import execa, { ExecaChildProcess } from 'execa'
import fs from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
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
   * Setup the temporary directory based on the contents of some fixture.
   */
  fixture: (name: string) => void
  /**
   * Spawn the Prisma cli using the temporary directory as the CWD.
   *
   * @remarks
   *
   * For this to work the source must be built!
   */
  cli: (...input: string[]) => ExecaChildProcess<string>
}

/**
 * Create test context to use in tests. Provides the following:
 *
 * - A temporary directory
 * - an fs-jetpack instance bound to the temporary directory
 * - Mocked process.cwd via Node process.chdir
 * - Fixture loader for boostrapping the temporary directory with content
 */
export const Context = {
  new: function (ctx: BaseContext = {} as any) {
    const c = ctx as any

    beforeEach(() => {
      c.tmpDir = tempy.directory()
      c.fs = fs.cwd(c.tmpDir)
      c.fixture = (name: string) => {
        c.fs.copy(path.join(__dirname, '..', 'fixtures', name), '.', {
          overwrite: true,
        })
      }
      c.mocked = c.mocked ?? {}
      c.mocked.cwd = process.cwd()
      c.cli = (...input) => {
        return execa.node(
          path.join(__dirname, '../../../build/index.js'),
          input,
          {
            cwd: c.fs.cwd(),
            stdio: 'pipe',
          },
        )
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
type ContextContributorFactory<
  Settings,
  Context,
  NewContext
  > = Settings extends {}
  ? () => ContextContributor<Context, NewContext>
  : (settings: Settings) => ContextContributor<Context, NewContext>

/**
 * A function that provides additonal test context.
 */
type ContextContributor<Context, NewContext> = (ctx: Context) => NewContext

/**
 * Main context builder API that permits recursively building up context.
 */
function factory<Context>(ctx: Context) {
  return {
    add<NewContext>(
      contextContributor: ContextContributor<Context, NewContext>,
    ) {
      contextContributor(ctx)
      return factory<Context & NewContext>(ctx as any)
    },
    assemble(): Context {
      return ctx
    },
  }
}

/**
 * Test context contributor. Mocks console.error with a Jest spy before each test.
 */
export const consoleContext: ContextContributorFactory<
  {},
  BaseContext,
  {
    mocked: {
      'console.error': jest.SpyInstance
      'console.log': jest.SpyInstance
      'console.warn': jest.SpyInstance
    }
  }
> = () => (ctx) => {
  beforeEach(() => {
    ctx.mocked['console.error'] = jest
      .spyOn(console, 'error')
      .mockImplementation(() => { })
    ctx.mocked['console.log'] = jest
      .spyOn(console, 'log')
      .mockImplementation(() => { })
    ctx.mocked['console.warn'] = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => { })
  })

  afterEach(() => {
    ctx.mocked['console.error'].mockRestore()
    ctx.mocked['console.log'].mockRestore()
    ctx.mocked['console.warn'].mockRestore()
  })

  return null as any
}
