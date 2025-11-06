import { mockMigrationAwareAdapterFactory } from '@prisma/driver-adapter-utils'
import { describe, expect, test } from 'vitest'

import { defaultConfig } from '../defaultConfig'
import { defaultTestConfig } from '../defaultTestConfig'
import { defineConfig } from '../defineConfig'
import type { PrismaConfig, PrismaConfigInternal } from '../PrismaConfig'

describe('defineConfig', () => {
  const baselineConfig = {
    datasource: {
      url: 'postgresql://DATABASE_URL',
    },
  } satisfies PrismaConfig

  test('defaultConfig', () => {
    const config = defaultConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "datasource": {
          "url": "<default_datasource_url>",
        },
        "loadedFromFile": null,
      }
    `)
    expect(typeof config.__brand).toEqual('symbol')
  })

  test('defaultTestConfig', () => {
    const config = defaultTestConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "datasource": {
          "url": "<default_datasource_url>",
        },
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
        ...baselineConfig,
        experimental: {
          studio: true,
          externalTables: true,
        },
      })
      expect(config.experimental).toEqual({
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
        ...baselineConfig,
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

    test('when `datasource`, it should configure Prisma Migrate using the provided adapter', () => {
      const config = defineConfig({
        datasource: {
          url: 'postgresql://DATABASE_URL',
          directUrl: 'https://DIRECT_DATABASE_URL',
          shadowDatabaseUrl: 'postgresql://SHADOW_DATABASE_URL',
        },
      })
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
        ...baselineConfig,
        migrations: {
          seed: 'tsx seed.ts',
        },
      })
      expect(config.migrations?.seed).toStrictEqual('tsx seed.ts')
    })
  })

  describe('experimental validation', () => {
    test('should throw error when studio is used without experimental.studio', () => {
      expect(() =>
        defineConfig({
          ...baselineConfig,
          studio: {
            adapter: () => Promise.resolve(mockMigrationAwareAdapterFactory('postgres')),
          },
        }),
      ).toThrow('The `studio` configuration requires `experimental.studio` to be set to `true`.')
    })

    test('should throw error when tables.external is used without experimental.externalTables', () => {
      expect(() =>
        defineConfig({
          ...baselineConfig,
          tables: {
            external: ['users'],
          },
        }),
      ).toThrow('The `tables.external` configuration requires `experimental.externalTables` to be set to `true`.')
    })

    test('should throw error when migrations.initShadowDb is used without experimental.externalTables', () => {
      expect(() =>
        defineConfig({
          ...baselineConfig,
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
          ...baselineConfig,
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
