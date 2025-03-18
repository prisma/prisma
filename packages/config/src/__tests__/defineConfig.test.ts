import { defaultConfig } from '../defaultConfig'
import { defaultTestConfig } from '../defaultTestConfig'
import { defineConfig } from '../defineConfig'
import type { PrismaConfig, PrismaConfigInternal } from '../PrismaConfig'

describe('defineConfig', () => {
  const baselineConfig = {
    earlyAccess: true,
  } satisfies PrismaConfig<never>

  describe('defaultConfig', () => {
    const config = defaultConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "earlyAccess": true,
        "loadedFromFile": null,
      }
    `)
    expect(typeof config.__brand).toEqual('symbol')
  })

  describe('defaultTestConfig', () => {
    const config = defaultTestConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "earlyAccess": true,
        "loadedFromFile": null,
      }
    `)
    expect(typeof config.__brand).toEqual('symbol')
  })

  describe('earlyAccess', () => {
    test('if `earlyAccess` is set to `true`, it should enable early access features', () => {
      const config = defineConfig(baselineConfig)
      expect(config.earlyAccess).toBe(true)
      expect(typeof config.__brand).toEqual('symbol')
    })
  })

  describe('studio', () => {
    test('if no `studio` configuration is provided, it should not configure Prisma Studio', () => {
      const config = defineConfig(baselineConfig)
      expect(config.studio).toBeUndefined()
    })

    test('if a `studio` configuration is provided, it should configure Prisma Studio using the provided adapter', () => {
      const adapter = jest.fn()
      const config = defineConfig({
        earlyAccess: true,
        studio: {
          adapter: adapter,
        },
      })
      expect(config.studio).toEqual({
        adapter: adapter,
      })
    })
  })

  describe('migrate', () => {
    test('if no `migrate` configuration is provided, it should not configure Prisma Migrate', () => {
      const config = defineConfig(baselineConfig)
      expect(config.migrate).toBeUndefined()
    })

    test('if a `migrate` configuration is provided, it should configure Prisma Migrate using the provided adapter', () => {
      const adapter = jest.fn()
      const config = defineConfig({
        earlyAccess: true,
        migrate: {
          adapter: adapter,
        },
      })
      expect(config.migrate).toEqual({
        adapter: adapter,
      })
    })
  })
})
