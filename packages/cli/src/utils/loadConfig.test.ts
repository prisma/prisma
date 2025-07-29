import path from 'node:path'

import { jestContext } from '@prisma/get-platform'
import { HelpError } from '@prisma/internals'

import { loadConfig } from './loadConfig'

const ctx = jestContext.new().assemble()

describe('loadConfig', () => {
  it('provides default config if no file config is found', async () => {
    const result = await loadConfig()

    expect(result).toMatchObject({
      config: {
        loadedFromFile: null,
      },
      diagnostics: [],
    })
  })

  it('returns formatted HelpError if config file loading failed', async () => {
    const config = await loadConfig('./does/not/exist.ts')

    expect(config).toEqual(
      new HelpError(`Config file not found at "${path.join(ctx.fs.cwd(), './does/not/exist.ts')}"`),
    )
  })
})
