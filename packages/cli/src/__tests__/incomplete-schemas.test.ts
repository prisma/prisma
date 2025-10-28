// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */
import { stripVTControlCharacters } from 'node:util'

import { defaultTestConfig, loadConfigFromFile } from '@prisma/config'
import { jestContext } from '@prisma/get-platform'
import { serializeQueryEngineName } from '@prisma/internals'
import { DbExecute, DbPull, DbPush, MigrateDev, MigrateReset } from '@prisma/migrate'
import fs from 'fs'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext.new().assemble()

async function loadFixtureConfig(configFile?: string) {
  const { config, error } = await loadConfigFromFile({ configFile })

  if (error) {
    if ('error' in error && error.error instanceof Error) {
      throw error.error
    }
    throw new Error(`Failed to load Prisma config: ${error._tag}`)
  }

  return config ?? defaultTestConfig()
}

/**
 * Commands:
 * - wasm engine
 *   - format
 * - library engine
 *   - validate
 *   - db push
 *   - db pull
 *   - db execute (doesn't use neither getDmmf nor getConfig directly)
 *   - migrate reset
 *   - migrate dev
 */

const dbExecuteSQLScript = `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`

describe('[wasm] incomplete-schemas', () => {
  describe('datasource-block-url-env-set-invalid', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-set-invalid')
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('format', async () => {
      expect.assertions(1)

      try {
        await Format.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchSnapshot()
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        const config = await loadFixtureConfig()
        await DbExecute.new().parse(['--file=./script.sql'], config)
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })
  })

  describe('datasource-block-url-env-unset', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-url-env-unset')
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        const config = await loadFixtureConfig()
        await DbExecute.new().parse(['--file=./script.sql'], config)
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('format', async () => {
      expect.assertions(1)

      try {
        await Format.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url')
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('format', async () => {
      expect.assertions(1)

      try {
        await Format.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })
  })

  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema')
    })

    it('validate', async () => {
      expect.assertions(1)
      try {
        await Validate.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('format', async () => {
      expect.assertions(1)

      try {
        await Format.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })
  })

  describe('datasource-block-no-url', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/datasource-block-no-url')
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        const config = await loadFixtureConfig()
        await DbExecute.new().parse(['--file=./script.sql'], config)
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(stripVTControlCharacters(e.message)).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })
  })
})

describe('[normalized library/binary] incomplete-schemas', () => {
  describe('empty-schema', () => {
    beforeEach(() => {
      ctx.fixture('incomplete-schemas/empty-schema')
    })

    it('db push', async () => {
      expect.assertions(1)
      try {
        await DbPush.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db pull', async () => {
      expect.assertions(1)
      try {
        await DbPull.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('db execute', async () => {
      fs.writeFileSync('script.sql', dbExecuteSQLScript)
      expect.assertions(1)

      try {
        const config = await loadFixtureConfig()
        await DbExecute.new().parse(['--file=./script.sql'], config)
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate reset', async () => {
      expect.assertions(1)
      try {
        await MigrateReset.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })

    it('migrate dev', async () => {
      expect.assertions(1)
      try {
        await MigrateDev.new().parse([], await loadFixtureConfig())
      } catch (e) {
        expect(serializeQueryEngineName(stripVTControlCharacters(e.message))).toMatchInlineSnapshot(
          `"Failed to load Prisma config: ConfigLoadError"`,
        )
      }
    })
  })
})
