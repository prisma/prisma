import { defineConfig, type PrismaConfig } from '../defineConfig'

describe('defineConfig', () => {
  const baselineConfig = {
    earlyAccess: true,
  } satisfies PrismaConfig<unknown>

  describe('earlyAccess', () => {
    test('if `earlyAccess` is set to `true`, it should enable experimental features', () => {
      const config = defineConfig(baselineConfig)
      expect(config.earlyAccess).toBe(true)
    })
  })
})
