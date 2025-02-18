import { defineConfig, type PrismaConfig } from '../defineConfig'

describe('defineConfig', () => {
  const baselineConfig = {
    earlyAccess: true,
  } satisfies PrismaConfig

  describe('earlyAccess', () => {
    test('if `earlyAccess` is set to `true`, it should enable early access features', () => {
      const config = defineConfig(baselineConfig)
      expect(config.earlyAccess).toBe(true)
    })
  })
})
