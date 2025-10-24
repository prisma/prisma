import {
  bindMigrationAwareSqlAdapterFactory,
  mockMigrationAwareAdapterFactory,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { describe, expect, test } from 'vitest'

import { defaultConfig } from '../defaultConfig'
import { defaultTestConfig } from '../defaultTestConfig'
import { defineConfig } from '../defineConfig'
import type { PrismaConfig, PrismaConfigInternal } from '../PrismaConfig'

describe('defineConfig', () => {
  function assertConfigWithEngineJs(config: PrismaConfigInternal): asserts config is PrismaConfigInternal & {
    engine: 'js'
    adapter: () => SqlMigrationAwareDriverAdapterFactory
  } {
    expect(config['engine']).toBe('js')
  }

  function assertConfigWithEngineClassic(config: PrismaConfigInternal): asserts config is PrismaConfigInternal & {
    engine: 'classic'
    datasource: {
      url: string
      directUrl?: string
      shadowDatabaseUrl?: string
    }
  } {
    expect(config['engine']).toBe('classic')
  }

  const baselineConfig = {} satisfies PrismaConfig

  test('defaultConfig', () => {
    const config = defaultConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "loadedFromFile": null,
      }
    `)
    expect(typeof config.__brand).toEqual('symbol')
  })

  test('defaultTestConfig', () => {
    const config = defaultTestConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "loadedFromFile": null,
      }
    `)
    expect(typeof config.__brand).toEqual('symbol')
  })

  describe('experimental', () => {
    test('if `experimental` is not provided, it should be undefined', () => {
      const config = defineConfig(baselineConfig)
      expect(config.experimental).toBeUndefined()
      expect(typeof config.__brand).toEqual('symbol')
    })

    test('if `experimental` features are provided, they should be configured', () => {
      const config = defineConfig({
        experimental: {
          adapter: true,
          studio: true,
          externalTables: true,
        },
      })
      expect(config.experimental).toEqual({
        adapter: true,
        studio: true,
        externalTables: true,
      })
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
      const config = defineConfig({
        experimental: {
          studio: true,
        },
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

      const adapter = await adapterFactory()
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(expectedAdapter))
    })
  })

  describe('engine', () => {
    test("if no `engine` configuration is provided, it should not configure Prisma CLI's adapter", () => {
      const config = defineConfig(baselineConfig)
      expect(config.engine).toBeUndefined()
    })

    test('if `engine === "js"` configuration is provided, it should configure Prisma Migrate using the provided adapter', async () => {
      const expectedAdapter = mockMigrationAwareAdapterFactory('postgres')
      const config = defineConfig({
        experimental: {
          adapter: true,
        },
        engine: 'js',
        adapter: () => Promise.resolve(expectedAdapter),
      })
      assertConfigWithEngineJs(config)
      expect(config.adapter).toStrictEqual(expect.any(Function))

      const { adapter: adapterFactory } = config
      expect(adapterFactory).toBeDefined()

      const adapter = await adapterFactory()
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(bindMigrationAwareSqlAdapterFactory(expectedAdapter)))
    })

    test('if `engine === "classic"` configuration is provided, it should configure Prisma Migrate using the provided adapter', () => {
      const config = defineConfig({
        engine: 'classic',
        datasource: {
          url: 'postgresql://DATABASE_URL',
          directUrl: 'https://DIRECT_DATABASE_URL',
          shadowDatabaseUrl: 'postgresql://SHADOW_DATABASE_URL',
        },
      })
      assertConfigWithEngineClassic(config)
      expect(config.datasource).toMatchObject({
        url: 'postgresql://DATABASE_URL',
        directUrl: 'https://DIRECT_DATABASE_URL',
        shadowDatabaseUrl: 'postgresql://SHADOW_DATABASE_URL',
      })
    })
  })

  describe('migrations', () => {
    test('if `seed` is provided, it should be included in the migrations config', () => {
      const config = defineConfig({
        migrations: {
          seed: 'tsx seed.ts',
        },
      })
      expect(config.migrations?.seed).toStrictEqual('tsx seed.ts')
    })
  })

  describe('experimental validation', () => {
    test('should throw error when adapter is used without experimental.adapter', () => {
      expect(() =>
        defineConfig({
          engine: 'js',
          adapter: () => Promise.resolve(mockMigrationAwareAdapterFactory('postgres')),
        }),
      ).toThrow('The `engine === "js"` configuration requires `experimental.adapter` to be set to `true`.')
    })

    test('should throw error when studio is used without experimental.studio', () => {
      expect(() =>
        defineConfig({
          studio: {
            adapter: () => Promise.resolve(mockMigrationAwareAdapterFactory('postgres')),
          },
        }),
      ).toThrow('The `studio` configuration requires `experimental.studio` to be set to `true`.')
    })

    test('should throw error when tables.external is used without experimental.externalTables', () => {
      expect(() =>
        defineConfig({
          tables: {
            external: ['users'],
          },
        }),
      ).toThrow('The `tables.external` configuration requires `experimental.externalTables` to be set to `true`.')
    })

    test('should throw error when migrations.initShadowDb is used without experimental.externalTables', () => {
      expect(() =>
        defineConfig({
          migrations: {
            initShadowDb: 'CREATE TABLE users();',
          },
        }),
      ).toThrow(
        'The `migrations.initShadowDb` configuration requires `experimental.externalTables` to be set to `true`.',
      )
    })

    test.each([{ whatever: true }, false])(
      'should throw an error when extensions are used without the experimental flag (%o)',
      (extensions) => {
        const newLocal = {
          experimental: {},
          extensions,
        }
        expect(() => defineConfig(newLocal)).toThrow(
          'The `extensions` configuration requires `experimental.extensions` to be set to `true`.',
        )
      },
    )
  })
})
