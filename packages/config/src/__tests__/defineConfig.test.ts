import { bindMigrationAwareSqlAdapterFactory, mockMigrationAwareAdapterFactory } from '@prisma/driver-adapter-utils'

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

    test('if a `studio` configuration is provided, it should configure Prisma Studio using the provided adapter', async () => {
      const expectedAdapter = mockMigrationAwareAdapterFactory('postgres')
      const config = defineConfig<any>({
        earlyAccess: true,
        studio: {
          adapter: () => Promise.resolve(expectedAdapter),
        },
      })
      expect(config.studio).toStrictEqual({
        adapter: expect.any(Function),
      })

      if (!config?.studio) {
        throw new Error('Expected config.studio to be defined')
      }

      const { adapter: adapterFactory } = config.studio
      expect(adapterFactory).toBeDefined()

      const adapter = await adapterFactory(process.env)
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(expectedAdapter))
    })
  })

  describe('migrate', () => {
    test('if no `migrate` configuration is provided, it should not configure Prisma Migrate', () => {
      const config = defineConfig(baselineConfig)
      expect(config.migrate).toBeUndefined()
    })

    test('if a `migrate` configuration is provided, it should configure Prisma Migrate using the provided adapter', async () => {
      const expectedAdapter = mockMigrationAwareAdapterFactory('postgres')
      const config = defineConfig<any>({
        earlyAccess: true,
        migrate: {
          adapter: () => Promise.resolve(expectedAdapter),
        },
      })
      expect(config.migrate).toStrictEqual({
        adapter: expect.any(Function),
      })

      if (!config?.migrate?.adapter) {
        throw new Error('Expected config.migrate to be defined')
      }

      const adapterFactory = config.migrate.adapter
      expect(adapterFactory).toBeDefined()

      const adapter = await adapterFactory(process.env)
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(bindMigrationAwareSqlAdapterFactory(expectedAdapter)))
    })
  })
})
