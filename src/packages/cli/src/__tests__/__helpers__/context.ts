import * as FSJet from 'fs-jetpack'
import { FSJetpack } from 'fs-jetpack/types'
import * as Path from 'path'
import tempy from 'tempy'

export const Context = {
  new: function <
    Extra = {},
    Context = Extra & {
      tmpDir: string
      fs: FSJetpack
      mocked: { cwd: string }
      fixture: (name: string) => void
    }
  >(ctx: Extra = {} as any): Context {
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

    return ctx as any
  },
}
