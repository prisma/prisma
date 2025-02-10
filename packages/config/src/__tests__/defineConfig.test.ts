import { defineConfig, type PrismaConfigInput } from '../defineConfig'

describe('defineConfig', () => {
  const baselineConfig = {
    experimental: true,
  } satisfies PrismaConfigInput<unknown>

  describe('studio', () => {
    test('if no `studio` configuration is provided, it should not configure Prisma Studio', () => {
      const config = defineConfig(baselineConfig)
      expect(config.studio).toBeUndefined()
    })

    test('if a `studio` configuration is provided, it should configure Prisma Studio using the provided adapter', () => {
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
