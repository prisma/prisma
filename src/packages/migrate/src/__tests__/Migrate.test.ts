import assert from 'assert'
import del from 'del'
import mkdir from 'make-dir'
import fs from 'fs'
import { promisify } from 'util'
import { dirname, join } from 'path'
import tempy from 'tempy'
import dedent from 'strip-indent'
import Database from 'sqlite-async'
import stripAnsi from 'strip-ansi'
import { Migrate } from '../Migrate'
import { MigrateSave } from '../commands/legacy/MigrateSave'

const writeFile = promisify(fs.writeFile)
const testRootDir = tempy.directory()

const oldProcessCwd = process.cwd

describe('migrate.create', () => {
  beforeEach(async () => {
    process.cwd = () => testRootDir
    await mkdir(testRootDir)
  })

  afterEach(async () => {
    process.cwd = oldProcessCwd
    await del(testRootDir, { force: true }) // Need force: true because `del` does not delete dirs outside the CWD
  })

  createTests().map((t) => {
    // eslint-disable-next-line jest/expect-expect
    test(t.name, async () => {
      const schemaPath = join(testRootDir, Object.keys(t.fs)[0])
      await writeFiles(testRootDir, t.fs)
      await t.fn(schemaPath)
    })
  })
})

// create a temporary set of files
async function writeFiles(
  root: string,
  files: {
    [name: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
): Promise<string> {
  for (const name in files) {
    const filepath = join(root, name)
    await mkdir(dirname(filepath))
    await writeFile(filepath, dedent(files[name]))
  }
  // return the test path
  return root
}

function replaceTimestamp(string: string): string {
  const regex = /[0-9]{14}/gm
  return string.replace(regex, 'X'.repeat(14))
}

// create file tests
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createTests() {
  return [
    {
      name: 'simple ok',
      fs: {
        'schema.prisma': `
          datasource my_db {
            provider = "sqlite"
            url = "file:./db/db_file.db"
            default = true
          }

          model User {
            id Int @id
          }
        `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup')
        const result = await migrate.save(migration!, 'setup')
        migrate.stop()
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn't be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
        expect(migration?.datamodelSteps).toMatchSnapshot()
        expect(migration?.warnings).toMatchSnapshot()
        expect(migration?.unexecutableMigrations).toMatchSnapshot()
      },
    },
    {
      name: 'spaces ok',
      fs: {
        'schema.prisma': `
          datasource my_db {
            provider = "sqlite"
            url = "file:./db/db_file.db"
            default = true
          }

          model User {
            id Int @id
          }
        `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('initial setup')
        const result = await migrate.save(migration!, 'initial setup')
        migrate.stop()
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn't be undefined`)
        }
        assert.ok(result.migrationId.includes(`-initial-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
        expect(migration?.datamodelSteps).toMatchSnapshot()
        expect(migration?.warnings).toMatchSnapshot()
        expect(migration?.unexecutableMigrations).toMatchSnapshot()
      },
    },
    {
      name: 'dashes ok',
      fs: {
        'schema.prisma': `
          datasource my_db {
            provider = "sqlite"
            url = "file:./db/db_file.db"
            default = true
          }

          model User {
            id Int @id
          }
        `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('initial setup')
        const result = await migrate.save(migration!, 'initial setup')
        migrate.stop()
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn't be undefined`)
        }
        assert.ok(result.migrationId.includes(`-initial-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
        expect(migration?.datamodelSteps).toMatchSnapshot()
        expect(migration?.warnings).toMatchSnapshot()
        expect(migration?.unexecutableMigrations).toMatchSnapshot()
      },
    },
    {
      name: 'custom schema filename ok',
      fs: {
        'myawesomeschema.file': `
          datasource my_db {
            provider = "sqlite"
            url = "file:./db/db_file.db"
            default = true
          }

          model User {
            id Int @id
          }
        `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup')
        const result = await migrate.save(migration!, 'setup')
        migrate.stop()
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn't be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
        expect(migration?.datamodelSteps).toMatchSnapshot()
        expect(migration?.warnings).toMatchSnapshot()
        expect(migration?.unexecutableMigrations).toMatchSnapshot()
      },
    },
    {
      name: 'custom folder and schema filename name ok',
      fs: {
        'awesome/myawesomeschema.file': `
          datasource my_db {
            provider = "sqlite"
            url = "file:../db/db_file.db"
            default = true
          }

          model User {
            id Int @id
          }
        `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup')
        const result = await migrate.save(migration!, 'setup')
        migrate.stop()
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn't be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
        expect(migration?.datamodelSteps).toMatchSnapshot()
        expect(migration?.warnings).toMatchSnapshot()
        expect(migration?.unexecutableMigrations).toMatchSnapshot()
      },
    },
    {
      name: 'invalid ok',
      fs: {
        'schema.prisma': `
          datasource my_db {
            provider = "sqlite"
            url = "file:./db/db_file.db"
            default = true
          }

          model User {
            id Int @id
            canBeNull String?
          }
        `,
        'schema-not-null.prisma': `
          datasource my_db {
            provider = "sqlite"
            url = "file:./db/db_file.db"
            default = true
          }

          model User {
            id Int @id
            canBeNull String
            requiredSomething String
          }
        `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup1')
        const result = await migrate.save(migration!, 'setup1')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn't be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup1'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
        expect(migration?.datamodelSteps).toMatchSnapshot()
        expect(migration?.warnings).toMatchSnapshot()
        expect(migration?.unexecutableMigrations).toMatchSnapshot()

        // Save from CLI - write files to filesystem
        const resultSave = await MigrateSave.new().parse([
          `--schema=${schemaPath}`,
          `--name=init`,
          '--experimental',
        ])
        expect(
          replaceTimestamp(stripAnsi(resultSave as string)),
        ).toMatchSnapshot()

        await migrate.upLegacy()
        migrate.stop()

        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        /* eslint-disable @typescript-eslint/no-unsafe-call */
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        const db = await Database.open(
          schemaPath.replace('schema.prisma', 'db/db_file.db'),
        )
        await db.exec('INSERT INTO User (canBeNull) VALUES ("Something!")')
        await db.close()
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
        /* eslint-enable @typescript-eslint/no-unsafe-call */
        /* eslint-enable @typescript-eslint/no-unsafe-member-access */

        const schemaPath2 = schemaPath.replace(
          'schema.prisma',
          'schema-not-null.prisma',
        )
        const migrate2 = new Migrate(schemaPath2)
        const migration2 = await migrate2.createMigration('setup2')
        const result2 = await migrate2.save(migration2!, 'setup2')
        migrate2.stop()
        if (typeof result2 === 'undefined') {
          return assert.fail(`result2 shouldn't be undefined`)
        }
        assert.ok(result2.migrationId.includes('-setup2'))
        assert.ok(result2.newLockFile)
        assert.ok(result2.files['steps.json'])
        assert.ok(result2.files['schema.prisma'])
        assert.ok(result2.files['README.md'])
        expect(migration2?.datamodelSteps).toMatchSnapshot()
        expect(migration2?.warnings).toMatchSnapshot()

        const oldConsoleLog = console.log
        const logs: string[] = []
        console.log = (...args) => {
          logs.push(...args)
        }

        try {
          // Save from CLI - write files to filesystem
          await MigrateSave.new().parse([
            `--schema=${schemaPath2}`,
            `--name=init-2`,
            '--experimental',
          ])
        } catch (e) {
          // Should error with unexecutableMigrations:
          /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
          expect(stripAnsi(e.message)).toMatchSnapshot()
        }
        console.log = oldConsoleLog
        expect(stripAnsi(logs.join('\n'))).toMatchSnapshot()
      },
    },
    {
      name: 'simple debug panic',
      fs: {
        'schema.prisma': `
      datasource my_db {
        provider = "sqlite"
        url = "file:./db/db_file.db"
        default = true
      }

      model User {
        id Int @id
      }
    `,
        'db/.keep': ``,
      },
      fn: async (schemaPath: string): Promise<undefined> => {
        const migrate = new Migrate(schemaPath)

        try {
          await migrate.engine.debugPanic()
        } catch (e) {
          expect(
            // remove hash
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            stripAnsi(e.message).replace(/\/rustc\/(.+)\//, '/rustc/hash/'),
          ).toMatchSnapshot()
        } finally {
          migrate.stop()
        }
        return
      },
    },
  ]
}
