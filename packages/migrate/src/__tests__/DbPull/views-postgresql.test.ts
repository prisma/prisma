// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import { fsUtils, getSchema } from '@prisma/internals'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { MigrateEngine } from '../../MigrateEngine'
import { runQueryPostgres, SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describe('postgresql views fs I/O', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-postgresql-views',
  )

  type ViewVariant =
    | 'no-views' // No views in the database
    | 'no-preview' // No "view" in `previewFeatures`

  const variantToPath = (variant?: ViewVariant) => {
    const basePath = 'views-fs' as const
    return variant === undefined ? basePath : (`${basePath}-${variant}` as const)
  }

  const computeSetupParams = (variant?: ViewVariant) => {
    const fixturePath = path.join('introspection', 'postgresql', variantToPath(variant))

    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', fixturePath),
    }

    return { setupParams, fixturePath }
  }

  const setupPostgresForViewsIO = (variant?: ViewVariant) => {
    const { setupParams, fixturePath } = computeSetupParams(variant)

    beforeEach(async () => {
      await setupPostgres(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    return { setupParams, fixturePath }
  }

  describe('engine output', () => {
    describe('no preview feature', () => {
      const { fixturePath } = setupPostgresForViewsIO('no-preview')

      it('`views` is null', async () => {
        ctx.fixture(path.join(fixturePath))

        const engine = new MigrateEngine({
          projectDir: process.cwd(),
          schemaPath: undefined,
        })

        const schema = await getSchema()

        const introspectionResult = await engine.introspect({
          schema,
          force: false,
        })

        expect(introspectionResult.views).toEqual(null)
        engine.stop()
      })
    })

    describe('with preview feature and no views defined', () => {
      const { fixturePath } = setupPostgresForViewsIO('no-views')

      it('`views` is [] and no views folder is created', async () => {
        ctx.fixture(path.join(fixturePath))

        const engine = new MigrateEngine({
          projectDir: process.cwd(),
          schemaPath: undefined,
        })

        const schema = await getSchema()

        const introspectionResult = await engine.introspect({
          schema,
          force: false,
        })

        expect(introspectionResult.views).toEqual([])
        engine.stop()

        const listWithoutViews = await ctx.fs.listAsync('views')
        expect(listWithoutViews).toEqual(undefined)
      })

      it('`views` is [] and an empty existing views folder is deleted', async () => {
        ctx.fixture(path.join(fixturePath))

        // Empty dir should be deleted along the views dir
        await ctx.fs.dirAsync('views/empty-dir')

        expect(await ctx.fs.listAsync()).toEqual(['node_modules', 'schema.prisma', 'setup.sql', 'views'])
        expect(await ctx.fs.listAsync('views')).toEqual(['empty-dir'])

        const engine = new MigrateEngine({
          projectDir: process.cwd(),
          schemaPath: undefined,
        })

        const schema = await getSchema()

        const introspectionResult = await engine.introspect({
          schema,
          force: false,
        })

        expect(introspectionResult.views).toEqual([])
        engine.stop()

        const listWithoutViews = await ctx.fs.listAsync('views')
        expect(listWithoutViews).toEqual(undefined)
        // The views folder is deleted
        expect(await ctx.fs.listAsync()).toEqual(['node_modules', 'schema.prisma', 'setup.sql'])
      })

      it('`views` is [] and a non-empty existing views folder is kept', async () => {
        ctx.fixture(path.join(fixturePath))

        ctx.fs.write('views/README.md', 'Some readme markdown')
        expect(await ctx.fs.listAsync()).toEqual(['node_modules', 'schema.prisma', 'setup.sql', 'views'])
        expect(await ctx.fs.listAsync('views')).toEqual(['README.md'])

        const engine = new MigrateEngine({
          projectDir: process.cwd(),
          schemaPath: undefined,
        })

        const schema = await getSchema()

        const introspectionResult = await engine.introspect({
          schema,
          force: false,
        })

        expect(introspectionResult.views).toEqual([])
        engine.stop()

        const listWithoutViews = await ctx.fs.listAsync('views')
        expect(listWithoutViews).toEqual(['README.md'])
        expect(await ctx.fs.listAsync()).toEqual(['node_modules', 'schema.prisma', 'setup.sql', 'views'])
      })
    })
  })

  describe('with preview feature, views defined and then removed', () => {
    const { setupParams, fixturePath } = setupPostgresForViewsIO()

    test('re-introspection with views removed', async () => {
      ctx.fixture(fixturePath)

      const introspectWithViews = new DbPull()
      const resultWithViews = introspectWithViews.parse([])
      await expect(resultWithViews).resolves.toMatchInlineSnapshot(``)

      const listWithViews = await ctx.fs.listAsync('views')
      expect(listWithViews).toMatchInlineSnapshot(`
        [
          public,
          work,
        ]
      `)

      const treeWithViews = await ctx.fs.findAsync({
        directories: false,
        files: true,
        recursive: true,
        matching: 'views/**/*',
      })
      expect(treeWithViews).toMatchInlineSnapshot(`
        [
          views/public/simpleuser.sql,
          views/work/workers.sql,
        ]
      `)

      const dropViewsSQL = await ctx.fs.readAsync('./drop_views.sql', 'utf8')

      // remove any view in the database
      await runQueryPostgres(setupParams, dropViewsSQL!)

      const introspectWithoutViews = new DbPull()
      const resultWithoutViews = introspectWithoutViews.parse([])
      await expect(resultWithoutViews).resolves.toMatchInlineSnapshot(``)

      const listWithoutViews = await ctx.fs.listAsync('views')
      expect(listWithoutViews).toEqual(undefined)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        Prisma schema loaded from schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"
        Prisma schema loaded from schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


                        - Introspecting based on datasource defined in schema.prisma

                        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
                              
                        *** WARNING ***

                        The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                          - "simpleuser"
                          - "workers"

                        Run prisma generate to generate Prisma Client.



                        - Introspecting based on datasource defined in schema.prisma

                        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
                              
                        Run prisma generate to generate Prisma Client.

                  `)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('with preview feature and views defined', () => {
    const { fixturePath } = setupPostgresForViewsIO()

    test('basic introspection', async () => {
      ctx.fixture(fixturePath)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          public,
          work,
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          views/public/simpleuser.sql,
          views/work/workers.sql,
        ]
      `)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        Prisma schema loaded from schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        *** WARNING ***

        The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
          - "simpleuser"
          - "workers"

        Run prisma generate to generate Prisma Client.

      `)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    const schemaPaths = [
      {
        schemaDir: 'prisma',
        schemaFilename: 'schema.prisma',
        needsMove: true,
        needsPathsArg: false,
      },
      {
        schemaDir: 'custom/schema/dir',
        schemaFilename: 'schema.prisma',
        needsMove: true,
        needsPathsArg: true,
      },
      {
        schemaDir: '',
        schemaFilename: 'non-standard-schema.prisma',
        needsMove: true,
        needsPathsArg: true,
      },
      {
        schemaDir: '',
        schemaFilename: 'schema.prisma',
        needsMove: false,
        needsPathsArg: false,
      },
    ] as const

    for (const { schemaDir, schemaFilename, needsMove, needsPathsArg } of schemaPaths) {
      const schemaPath = path.posix.join(schemaDir, schemaFilename)
      const viewsPath = path.posix.join(schemaDir, 'views')
      const testName = `introspection from ${schemaPath} creates view definition files`

      test(testName, async () => {
        ctx.fixture(fixturePath)

        if (needsMove) {
          await ctx.fs.moveAsync('schema.prisma', schemaPath)
        }

        const introspect = new DbPull()
        const args = needsPathsArg ? ['--schema', `${schemaPath}`] : []
        const result = introspect.parse(args)
        await expect(result).resolves.toMatchInlineSnapshot(``)

        // the folders in `views` match the database schema names (public, work) of the views
        // defined in the `setup.sql` file
        const list = await ctx.fs.listAsync(viewsPath)
        expect(list).toMatchInlineSnapshot(`
          [
            public,
            work,
          ]
        `)

        const tree = await ctx.fs.findAsync({
          directories: false,
          files: true,
          recursive: true,
          matching: `${viewsPath}/**/*`,
        })
        const polishedTree = tree.map(fsUtils.normalizePossiblyWindowsDir)
        expect(polishedTree).toMatchSnapshot()

        const publicSimpleUserView = await ctx.fs.readAsync(`${viewsPath}/public/simpleuser.sql`)
        expect(publicSimpleUserView).toMatchInlineSnapshot(`
          SELECT
            su.first_name,
            su.last_name
          FROM
            someuser su;
        `)

        const workWorkersView = await ctx.fs.readAsync(`${viewsPath}/work/workers.sql`)
        expect(workWorkersView).toMatchInlineSnapshot(`
          SELECT
            su.first_name,
            su.last_name,
            c.name AS company_name
          FROM
            (
              someuser su
              LEFT JOIN WORK.company c ON ((su.company_id = c.id))
            );
        `)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    }

    test('extraneous empty subdirectories should be deleted and top files kept in views directory on introspect', async () => {
      ctx.fixture(path.join(fixturePath))

      await ctx.fs.dirAsync('views')
      const initialList = await ctx.fs.listAsync('views')
      expect(initialList).toMatchInlineSnapshot(`[]`)

      // Empty dir should be deleted
      await ctx.fs.dirAsync('views/empty-dir')
      // Any file on the top level should be kept
      await ctx.fs.fileAsync('views/README')
      await ctx.fs.fileAsync('views/extraneous-file.sql')
      const extraneousList = await ctx.fs.listAsync('views')
      extraneousList?.sort((a, b) => a.localeCompare(b, 'en-US'))
      expect(extraneousList).toMatchInlineSnapshot(`
        [
          empty-dir,
          extraneous-file.sql,
          README,
        ]
      `)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      // the folders in `views` match the database schema names (public, work) of the views
      // defined in the `setup.sql` file
      const list = await ctx.fs.listAsync('views')
      list?.sort((a, b) => a.localeCompare(b, 'en-US'))
      expect(list).toMatchInlineSnapshot(`
        [
          extraneous-file.sql,
          public,
          README,
          work,
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      tree?.sort((a, b) => a.localeCompare(b, 'en-US'))
      expect(tree).toMatchInlineSnapshot(`
        [
          views/extraneous-file.sql,
          views/public/simpleuser.sql,
          views/README,
          views/work/workers.sql,
        ]
      `)
    })
  })

  describe('no preview', () => {
    const { fixturePath } = setupPostgresForViewsIO('no-preview')

    test('basic introspection', async () => {
      ctx.fixture(path.join(fixturePath))

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`undefined`)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`[]`)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        Prisma schema loaded from schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        Run prisma generate to generate Prisma Client.

      `)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    test('introspect with already existing files in "views"', async () => {
      ctx.fixture(path.join(fixturePath))

      await ctx.fs.dirAsync('views/extraneous-dir')
      await ctx.fs.fileAsync('views/extraneous-file.sql')
      const extraneousList = await ctx.fs.listAsync('views')
      expect(extraneousList).toMatchInlineSnapshot(`
        [
          extraneous-dir,
          extraneous-file.sql,
        ]
      `)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          extraneous-dir,
          extraneous-file.sql,
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          views/extraneous-file.sql,
        ]
      `)
    })
  })
})

describe('postgresql views re-introspection warnings', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-postgresql-views',
  )

  function computeSetupParams(warningCode: number, variant?: number): SetupParams {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '..',
        '__tests__',
        'fixtures',
        're-introspection',
        'postgresql',
        `views-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  function setupPostgressForWarning(warningCode: number, variant?: number) {
    const setupParams = computeSetupParams(warningCode, variant)

    beforeEach(async () => {
      await setupPostgres(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })
  }

  describe('postgresql views 21/1 - singular unsupported types (both view and model [code 3])', () => {
    const warningCode = 21
    const variant = 1
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        model reservations {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        view res {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
                //   - Model: "reservations", field: "dates", original data type: "daterange"
                // 
                // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
                //   - View: "res", field: "dates", original data type: "daterange"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 21/2 - multiline unsupported types (both view and model [code 3])', () => {
    const warningCode = 21
    const variant = 2
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        model reservations {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        view res {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        view dates {
          id    Int                      @id
          dates Unsupported("daterange")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
                //   - Model: "reservations", field: "dates", original data type: "daterange"
                // 
                // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
                //   - View: "res", field: "dates", original data type: "daterange"
                //   - View: "dates", field: "dates", original data type: "daterange"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 22/1 - field with @map', () => {
    const warningCode = 22
    const variant = 1
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        view A {
          id Int @id @map("foo")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These fields were enriched with \`@map\` information taken from the previous Prisma schema:
                //   - View: "A", field: "id"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 22/2 - field with @map', () => {
    const warningCode = 22
    const variant = 2
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        view A {
          id Int @id @map("foo")
        }

        view B {
          id Int @id @map("bar")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These fields were enriched with \`@map\` information taken from the previous Prisma schema:
                //   - View: "A", field: "id"
                //   - View: "B", field: "id"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 23 - automated rename with @@map', () => {
    const warningCode = 23
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        view Renamedif {
          id Int @id

          @@map("if")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These views were enriched with \`@@map\` information taken from the previous Prisma schema:
                //   - "Renamedif"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 24 - no unique identifier', () => {
    const warningCode = 24
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        model User {
          id         Int     @id @default(autoincrement())
          first_name String  @db.VarChar(255)
          last_name  String? @db.VarChar(255)
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Schwuser {
          id         Int?
          first_name String? @db.VarChar(255)
          last_name  String? @db.VarChar(255)

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                //   - "Schwuser"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 25 - @@id name', () => {
    const warningCode = 25
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        view B {
          a Int
          b Int

          @@id([a, b], name: "kekw")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These views were enriched with custom compound id names taken from the previous Prisma schema:
                //   - "B"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 26 - invalid field name', () => {
    const warningCode = 26
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view A {
          foo Int?

          /// This field was commented out because of an invalid name. Please provide a valid one that matches [a-zA-Z][a-zA-Z0-9_]*
          // 1 Int? @map("1")
          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These fields were commented out because their names are currently not supported by Prisma. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]* using the \`@map\` attribute:
                //   - View: "A", field(s): ["1"]
                // 
                // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                //   - "A"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})

describe('postgresql views introspection warnings', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-postgresql-views',
  )

  function computeSetupParams(warningCode: number, variant?: number): SetupParams {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'postgresql',
        `views-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  function setupPostgressForWarning(warningCode: number, variant?: number) {
    const setupParams = computeSetupParams(warningCode, variant)

    beforeEach(async () => {
      await setupPostgres(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })
  }

  describe('postgresql views 21 - unsupported types (both view and model [code 3])', () => {
    const warningCode = 21
    setupPostgressForWarning(warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        model reservations {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view res {
          id    Int?
          room  String?                   @db.VarChar
          dates Unsupported("daterange")?

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - "res"
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - Model: "reservations", field: "dates", original data type: "daterange"
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - View: "res", field: "dates", original data type: "daterange"
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  // * code 22 (automated rename with @map) requires a schema and therefore only appears in re-introspection

  // * code 23 (view with @@map) requires a schema and therefore only appears in re-introspection
  // * there is a similar output that gets appended to the schema during introspection however that is not an official warning

  describe('postgresql views 24/1 - singular no unique identifier', () => {
    const warningCode = 24
    const variant = 1
    setupPostgressForWarning(warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        model User {
          id         Int     @id @default(autoincrement())
          first_name String  @db.VarChar(255)
          last_name  String? @db.VarChar(255)
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Schwuser {
          id         Int?
          first_name String? @db.VarChar(255)
          last_name  String? @db.VarChar(255)

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                //   - "Schwuser"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 24/2 - multiple no unique identifier', () => {
    const warningCode = 24
    const variant = 2
    setupPostgressForWarning(warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        model User {
          id         Int     @id @default(autoincrement())
          first_name String  @db.VarChar(255)
          last_name  String? @db.VarChar(255)
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Schwuser {
          id         Int?
          first_name String? @db.VarChar(255)
          last_name  String? @db.VarChar(255)

          @@ignore
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Names {
          id         Int?
          first_name String? @db.VarChar(255)

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                //   - "Schwuser"
                //   - "Names"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  // * code 25 (@@id name) requires a previous schema to keep the @@id names from and therefore only appears in re-introspection

  describe('postgresql views 26 - invalid field name', () => {
    const warningCode = 26
    setupPostgressForWarning(warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider        = "prisma-client-js"
          previewFeatures = ["views"]
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view A {
          foo Int?

          /// This field was commented out because of an invalid name. Please provide a valid one that matches [a-zA-Z][a-zA-Z0-9_]*
          // 1 Int? @map("1")
          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These fields were commented out because their names are currently not supported by Prisma. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]* using the \`@map\` attribute:
                //   - View: "A", field(s): ["1"]
                // 
                // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                //   - "A"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})
