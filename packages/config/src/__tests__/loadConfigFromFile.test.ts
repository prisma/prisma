import path from 'node:path'
import { jestContext } from '@prisma/get-platform'
import { loadConfigFromFile } from '../loadConfigFromFile'

const ctx = jestContext.new().assemble()

describe('loadConfigFromFile', () => {
  it('default-location', async () => {
    ctx.fixture('loadConfigFromFile/default-location')

    const { config, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      experimental: true,
      env: {
        kind: 'load',
        loadEnv: expect.any(Function),
      },
    })
  })

  it('custom-location', async () => {
    ctx.fixture('loadConfigFromFile/custom-location')
    const customConfigPath = path.join('subfolder', 'prisma-config.ts')

    const { config, resolvedPath } = await loadConfigFromFile({
      configFile: customConfigPath,
    })
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), customConfigPath))
    expect(config).toMatchObject({
      experimental: true,
      env: {
        kind: 'load',
        loadEnv: expect.any(Function),
      },
    })
  })

  it('typescript-cjs-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-cjs-ext-ts')

    const { config, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      experimental: true,
      studio: {
        createAdapter: expect.any(Function),
      }
    })
    
    if (!config?.studio) {
      throw new Error('Expected config.studio to be defined')
    }

    const adapter = await config.studio.createAdapter({})
    expect(adapter).toBeDefined()
    expect(adapter.provider).toEqual('postgres')
  })

  it('typescript-esm-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-esm-ext-ts')

    const { config, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      experimental: true,
      studio: {
        createAdapter: expect.any(Function),
      }
    })
    
    if (!config?.studio) {
      throw new Error('Expected config.studio to be defined')
    }

    const adapter = await config.studio.createAdapter({})
    expect(adapter).toBeDefined()
    expect(adapter.provider).toEqual('postgres')
  })
})
