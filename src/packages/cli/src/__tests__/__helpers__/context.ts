import * as FSJet from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import * as Path from 'path'
import tempy from 'tempy'

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
}

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
      process.chdir(c.tmpDir)
    })

    afterEach(() => {
      process.chdir(c.mocked.cwd)
    })

    return factory(ctx)
  },
}

function factory<C>(ctx: C) {
  return {
    add<CExtra>(contributor: (ctx: C) => CExtra) {
      contributor(ctx)
      return factory<C & CExtra>(ctx as any)
    },
    assemble(): C {
      return ctx
    },
  }
}

/**
 * Mock console.error with a Jest spy before each test
 */
export function consoleContext(ctx: BaseContext) {
  beforeEach(() => {
    ctx.mocked['console.error'] = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    ctx.mocked['console.error'].mockRestore()
  })

  return (null as any) as { mocked: { 'console.error': jest.SpyInstance } }
}
