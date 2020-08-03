import assert from 'assert'
import del from 'del'
import mkdir from 'make-dir'
import fs from 'fs'
import { promisify } from 'util'
import { dirname, join } from 'path'
import pkgup from 'pkg-up'
import dedent from 'strip-indent'
import Sqlite from 'better-sqlite3'
import stripAnsi from 'strip-ansi'
import { Migrate } from '../Migrate'
import { SchemaPush } from '../commands/SchemaPush'

const writeFile = promisify(fs.writeFile)

describe('schema.create', () => {
  createTests().map((t) => {
    // eslint-disable-next-line jest/expect-expect
    test(t.name, async () => {
      const pkg = dirname((await pkgup({ cwd: __dirname })) || __filename)
      const root = join(pkg, 'tmp', 'schema-' + Date.now())
      const schemaPath = join(root, Object.keys(t.fs)[0])
      await writeFiles(root, t.fs)
      await t.fn(schemaPath)
      await del(root)
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
        const migration = await migrate.push()
        migrate.stop()
        expect(migration.executedSteps).toEqual(4)
        expect(migration.warnings).toEqual([])
        expect(migration.unexecutable).toEqual([])
        return
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
        const migration = await migrate.push()
        migrate.stop()
        expect(migration.executedSteps).toEqual(4)
        expect(migration.warnings).toEqual([])
        expect(migration.unexecutable).toEqual([])
        return
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
        const migration = await migrate.push()
        migrate.stop()
        expect(migration.executedSteps).toEqual(4)
        expect(migration.warnings).toEqual([])
        expect(migration.unexecutable).toEqual([])
        return
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
        const migration = await migrate.push()
        migrate.stop()
        expect(migration.executedSteps).toEqual(4)
        expect(migration.warnings).toEqual([])
        expect(migration.unexecutable).toEqual([])

        const db = new Sqlite(
          schemaPath.replace('schema.prisma', 'db/db_file.db'),
          {
            // verbose: console.log,
          },
        )
        const stmt = db.prepare('INSERT INTO User (canBeNull) VALUES (?)')
        const info = stmt.run('Something!')
        assert.equal(info.changes, 1)

        const oldConsoleLog = console.log
        const logs: string[] = []
        console.log = (...args) => {
          logs.push(...args)
        }

        const schemaPath2 = schemaPath.replace(
          'schema.prisma',
          'schema-not-null.prisma',
        )

        try {
          await SchemaPush.new().parse([
            `--schema=${schemaPath2}`,
            '--experimental',
          ])
        } catch (e) {
          // Should error with unexecutableMigrations:
          expect(stripAnsi(e.message)).toMatchSnapshot()
        }
        console.log = oldConsoleLog
        expect(stripAnsi(logs.join('\n'))).toMatchSnapshot()
        return
      },
    },
  ]
}
