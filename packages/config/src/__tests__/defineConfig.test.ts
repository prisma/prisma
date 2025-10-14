import { bindMigrationAwareSqlDriverFactory, mockMigrationAwareDriverFactory } from '@prisma/driver-utils'
import { describe, expect, test } from 'vitest'

import { defaultConfig } from '../defaultConfig'
import { defaultTestConfig } from '../defaultTestConfig'
import { defineConfig } from '../defineConfig'
import type { PrismaConfig, PrismaConfigInternal } from '../PrismaConfig'

describe('defineConfig', () => {
  const baselineConfig = {} satisfies PrismaConfig

  test('defaultConfig', () => {
    const config = defaultConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "deprecatedPackageJson": null,
        "loadedFromFile": null,
      }
    `)
    expect(typeof config.__brand).toEqual('symbol')
  })

  test('defaultTestConfig', () => {
    const config = defaultTestConfig() satisfies PrismaConfigInternal
    expect(config).toMatchInlineSnapshot(`
      {
        "deprecatedPackageJson": null,
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
          driver: true,
          studio: true,
          externalTables: true,
        },
      })
      expect(config.experimental).toEqual({
        driver: true,
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
      const expectedAdapter = mockMigrationAwareDriverFactory('postgres')
      const config = defineConfig({
        experimental: {
          studio: true,
        },
        studio: {
          driver: () => Promise.resolve(expectedAdapter),
        },
      })
      expect(config.studio).toStrictEqual({
        driver: expect.any(Function),
      })

      if (!config?.studio) {
        throw new Error('Expected config.studio to be defined')
      }

      const { driver: adapterFactory } = config.studio
      expect(adapterFactory).toBeDefined()

      const adapter = await adapterFactory()
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(expectedAdapter))
    })
  })

  describe('adapter', () => {
    test("if no `driver` configuration is provided, it should not configure Prisma CLI's adapter", () => {
      const config = defineConfig(baselineConfig)
      expect(config.driver).toBeUndefined()
    })

    test('if an `driver` configuration is provided, it should configure Prisma Migrate using the provided adapter', async () => {
      const expectedAdapter = mockMigrationAwareDriverFactory('postgres')
      const config = defineConfig({
        experimental: {
          driver: true,
        },
        driver: () => Promise.resolve(expectedAdapter),
      })
      expect(config.driver).toStrictEqual(expect.any(Function))

      if (!config?.driver) {
        throw new Error('Expected config.driver to be defined')
      }

      const { driver: adapterFactory } = config
      expect(adapterFactory).toBeDefined()

      const adapter = await adapterFactory()
      expect(JSON.stringify(adapter)).toEqual(JSON.stringify(bindMigrationAwareSqlDriverFactory(expectedAdapter)))
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
    test('should throw error when adapter is used without experimental.driver', () => {
      expect(() =>
        defineConfig({
          driver: () => Promise.resolve(mockMigrationAwareDriverFactory('postgres')),
        }),
      ).toThrow('The `driver` configuration requires `experimental.driver` to be set to `true`.')
    })

    test('should throw error when studio is used without experimental.studio', () => {
      expect(() =>
        defineConfig({
          studio: {
            driver: () => Promise.resolve(mockMigrationAwareDriverFactory('postgres')),
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
