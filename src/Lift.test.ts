import { join, dirname } from 'path'
import { writeFile } from 'mz/fs'
import dedent from 'strip-indent'
import { Lift } from './Lift'
import mkdir from 'make-dir'
import assert from 'assert'
import pkgup from 'pkg-up'
import del from 'del'

describe('lift.create', () => {
  createTests().map(t => {
    test(t.name, async () => {
      const pkg = dirname((await pkgup({ cwd: __dirname })) || __filename)
      const root = join(pkg, 'tmp', 'lift-' + Date.now())
      await writeFiles(root, t.fs)
      await t.fn(root)
      await del(root)
    })
  })
})

// create a temporary set of files
export default async function writeFiles(
  root: string,
  files: {
    [name: string]: string
  },
): Promise<string> {
  for (let name in files) {
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
        'project.prisma': `
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
      fn: async (root: string) => {
        const lift = new Lift(root)
        const migration = await lift.createMigration('setup')
        const result = await lift.save(migration!, 'setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(~result.migrationId.indexOf(`-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['datamodel.prisma'])
        assert.ok(result.files['README.md'])
      },
    },
    {
      name: 'spaces ok',
      fs: {
        'project.prisma': `
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
      fn: async (root: string) => {
        const lift = new Lift(root)
        const migration = await lift.createMigration('initial setup')
        const result = await lift.save(migration!, 'initial setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(~result.migrationId.indexOf(`-initial-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['datamodel.prisma'])
        assert.ok(result.files['README.md'])
      },
    },
    {
      name: 'dashes ok',
      fs: {
        'project.prisma': `
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
      fn: async (root: string) => {
        const lift = new Lift(root)
        const migration = await lift.createMigration('initial setup')
        const result = await lift.save(migration!, 'initial setup')
        if (typeof result === 'undefined') {
          return assert.fail(`result shouldn\'t be undefined`)
        }
        assert.ok(~result.migrationId.indexOf(`-initial-setup`))
        assert.ok(result.newLockFile)
        assert.ok(result.files['steps.json'])
        assert.ok(result.files['datamodel.prisma'])
        assert.ok(result.files['README.md'])
      },
    },
  ]
}
