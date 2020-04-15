import assert from 'assert'
import del from 'del'
import mkdir from 'make-dir'
import { writeFile } from 'mz/fs'
import { dirname, join } from 'path'
import pkgup from 'pkg-up'
import dedent from 'strip-indent'
import { Migrate } from './Migrate'

describe('migrate.create', () => {
  createTests().map((t) => {
    test(t.name, async () => {
      const pkg = dirname((await pkgup({ cwd: __dirname })) || __filename)
      const root = join(pkg, 'tmp', 'migrate-' + Date.now())
      const schemaPath = join(root, Object.keys(t.fs)[0])
      await writeFiles(root, t.fs)
      await t.fn(schemaPath)
      await del(root)
    })
  })
})

// create a temporary set of files
export default async function writeFiles(
  root: string,
  files: {
    [name: string]: any
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
      fn: async (schemaPath: string) => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup')
        const result = await migrate.save(migration!, 'setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
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
      fn: async (schemaPath: string) => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('initial setup')
        const result = await migrate.save(migration!, 'initial setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(result.migrationId.includes(`-initial-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
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
      fn: async (schemaPath: string) => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('initial setup')
        const result = await migrate.save(migration!, 'initial setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(result.migrationId.includes(`-initial-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
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
      fn: async (schemaPath: string) => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup')
        const result = await migrate.save(migration!, 'setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
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
      fn: async (schemaPath: string) => {
        const migrate = new Migrate(schemaPath)
        const migration = await migrate.createMigration('setup')
        const result = await migrate.save(migration!, 'setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(result.migrationId.includes('-setup'))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['schema.prisma'])
        assert.ok(result.files['README.md'])
      },
    },
  ]
}
