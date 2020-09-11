import execa, { ExecaChildProcess } from 'execa'
import * as FSJet from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import * as Path from 'path'
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
      c.fs = FSJet.cwd(c.tmpDir)
      c.fixture = (name: string) => {
        c.fs.copy(Path.join(__dirname, '..', 'fixtures', name), '.', {
          overwrite: true,
        })
      }
      c.mocked = c.mocked ?? {}
      c.mocked.cwd = process.cwd()
      c.cli = (...input) => {
        return execa.node(
          Path.join(__dirname, '../../../build/index.js'),
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
export const consoleContext: ContextContributor<
  BaseContext,
  { mocked: { 'console.error': jest.SpyInstance } }
> = (ctx) => {
  beforeEach(() => {
    ctx.mocked['console.error'] = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    ctx.mocked['console.error'].mockRestore()
  })

  return null as any
}
