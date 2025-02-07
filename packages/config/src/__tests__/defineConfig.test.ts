import { defineConfig, type PrismaConfigInput } from '../defineConfig'
import type { PrismaConfig, PrismaConfigEnvLoad } from '../PrismaConfig'

describe('defineConfig', () => {
  const baselineConfig = {
    experimental: true,
  } satisfies PrismaConfigInput<unknown>

  describe('loadEnv', () => {
    function assertKindLoad(
      configEnv: PrismaConfig['env'],
    ): asserts configEnv is PrismaConfigEnvLoad {
      expect(configEnv.kind).toBe('load')
    }

    test('if no `loadEnv` function is provided, it should skip loading any environment variables', () => {
      const config = defineConfig(baselineConfig)
      expect(config.env).toEqual({ kind: 'skip' })
    })

    test('if a `loadEnv` function is provided, it should load environment variables using the provided function', async () => {
      const config = defineConfig({
        experimental: true,
        loadEnv: async () => {
          return {
            TEST_CONNECTION_STRING: 'postgresql://something',
          }
        },
      })
      expect(config.env).toEqual({
        kind: 'load',
        loadEnv: expect.any(Function),
      })
      assertKindLoad(config.env)
      expect(await config.env.loadEnv()).toEqual({
        TEST_CONNECTION_STRING: 'postgresql://something',
      })
    })
  })

  describe('studio', () => {
    test('if no `studio` configuration is provided, it should not configure Prisma Studio', () => {
      const config = defineConfig(baselineConfig)
      expect(config.studio).toBeUndefined()
    })

    test('if a `studio` configuration is provided, it should configure Prisma Studio using the provided adapter', async () => {
      const adapter = jest.fn()
      const config = defineConfig({
        experimental: true,
        studio: {
          adapter: adapter,
        },
      })
      expect(config.studio).toEqual({
        createAdapter: adapter,
      })
    })
  })
})
