import { bindMigrationAwareSqlAdapterFactory } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from '../defaultConfig'
import { defaultTestConfig } from '../defaultTestConfig'
import { defineConfig } from '../defineConfig'
import type { PrismaConfig, PrismaConfigInternal } from '../PrismaConfig'
import { mockMigrationAwareAdapterFactory } from './_utils/mock-adapter'

describe('defineConfig', () => {
  const baselineConfig = {
    earlyAccess: true,
  } satisfies PrismaConfig<never>

  describe('defaultConfig', () => {
    const config = defaultConfig() satisfies DeepMutable<PrismaConfigInternal>
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
    test('if `earlyAccess` is set to `true`, it should enable early access features', async () => {
      const config = await defineConfig(baselineConfig)
      expect(config.earlyAccess).toBe(true)
      expect(typeof config.__brand).toEqual('symbol')
    })
  })

  describe('studio', () => {
    test('if no `studio` configuration is provided, it should not configure Prisma Studio', async () => {
      const config = await defineConfig(baselineConfig)
      expect(config.studio).toBeUndefined()
    })

    test('if a `studio` configuration is provided, it should configure Prisma Studio using the provided adapter', async () => {
      const config = await defineConfig({
        earlyAccess: true,
        studio: {
          adapter: () => Promise.resolve(mockMigrationAwareAdapterFactory('postgres')),
        },
      })
      expect(config).toMatchObject({
        earlyAccess: true,
        studio: {
          adapter: expect.any(Object),
        },
      })

      if (!config?.studio) {
        throw new Error('Expected config.studio to be defined')
      }
  
      const { adapter } = config.studio
      expect(adapter).toBeDefined()
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(mockMigrationAwareAdapterFactory('postgres')))
    })
  })

  describe('migrate', () => {
    test('if no `migrate` configuration is provided, it should not configure Prisma Migrate', async () => {
      const config = await defineConfig(baselineConfig)
      expect(config.migrate).toBeUndefined()
    })

    test('if a `migrate` configuration is provided, it should configure Prisma Migrate using the provided adapter', async () => {
      const expectedAdapter = mockMigrationAwareAdapterFactory('postgres')
      const config = await defineConfig({
        earlyAccess: true,
        migrate: {
          adapter: () => Promise.resolve(expectedAdapter),
        },
      })
      expect(config.migrate).toStrictEqual({
        adapter: expect.any(Object),
      })

      if (!config?.migrate) {
        throw new Error('Expected config.migrate to be defined')
      }

      const { adapter } = config.migrate
      expect(adapter).toBeDefined()
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(bindMigrationAwareSqlAdapterFactory(expectedAdapter)))
    })
  })
})
