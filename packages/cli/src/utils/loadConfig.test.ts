import path from 'node:path'

import { jestContext } from '@prisma/get-platform'
import { HelpError } from '@prisma/internals'

import { loadConfig } from './loadConfig'

const ctx = jestContext.new().assemble()

describe('loadConfig', () => {
  it('loads config from file', async () => {
    ctx.fixture('prisma-config')

    const config = await loadConfig('./prisma.config.ts')

    expect(config).toMatchObject({
      earlyAccess: true,
      loadedFromFile: path.join(ctx.fs.cwd(), './prisma.config.ts'),
    })
  })

  it('provides default config if no file config is found', async () => {
    const config = await loadConfig()

    expect(config).toMatchObject({
      earlyAccess: true,
      loadedFromFile: null,
    })
  })

  it('returns formatted HelpError if config file loading failed', async () => {
    const config = await loadConfig('./does/not/exist.ts')

    expect(config).toEqual(
      new HelpError(`Config file not found at "${path.join(ctx.fs.cwd(), './does/not/exist.ts')}"`),
    )
  })
})
