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
import { DbPush } from '../commands/DbPush'

const writeFile = promisify(fs.writeFile)
const testRootDir = tempy.directory()

describe('schema.create', () => {
  beforeEach(async () => {
    await mkdir(testRootDir)
  })

  afterEach(async () => {
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
        expect(migration.executedSteps).toEqual(1)
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
        expect(migration.executedSteps).toEqual(1)
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
        expect(migration.executedSteps).toEqual(1)
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
        expect(migration.executedSteps).toEqual(1)
        expect(migration.warnings).toEqual([])
        expect(migration.unexecutable).toEqual([])

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
          await DbPush.new().parse([
            `--schema=${schemaPath2}`,
            '--experimental',
          ])
        } catch (e) {
          // Should error with unexecutableMigrations:
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(stripAnsi(e.message)).toMatchSnapshot()
        }
        console.log = oldConsoleLog
        expect(stripAnsi(logs.join('\n'))).toMatchSnapshot()
        return
      },
    },
  ]
}
