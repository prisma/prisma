// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { getSchema, pathToPosix } from '@prisma/internals'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { SchemaEngine } from '../../SchemaEngine'
import { runQueryPostgres, SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'
import CaptureStdout from '../__helpers__/captureStdout'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describe('postgresql-views', () => {
  const captureStdout = new CaptureStdout()

  beforeEach(() => {
    captureStdout.startCapture()
  })

  afterEach(() => {
    captureStdout.clearCaptureText()
  })

  afterAll(() => {
    captureStdout.stopCapture()
  })

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

        const engine = new SchemaEngine({
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

        const engine = new SchemaEngine({
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

        const engine = new SchemaEngine({
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

        const engine = new SchemaEngine({
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
      await expect(resultWithViews).resolves.toMatchInlineSnapshot(`""`)

      const listWithViews = await ctx.fs.listAsync('views')
      expect(listWithViews).toMatchInlineSnapshot(`
        [
          "public",
          "work",
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
          "views/public/simpleuser.sql",
          "views/work/workers.sql",
        ]
      `)

      const dropViewsSQL = await ctx.fs.readAsync('./drop_views.sql', 'utf8')

      // remove any view in the database
      await runQueryPostgres(setupParams, dropViewsSQL!)

      const introspectWithoutViews = new DbPull()
      const resultWithoutViews = introspectWithoutViews.parse([])
      await expect(resultWithoutViews).resolves.toMatchInlineSnapshot(`""`)

      const listWithoutViews = await ctx.fs.listAsync('views')
      expect(listWithoutViews).toEqual(undefined)

      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
      expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
        "Prisma schema loaded from schema.prisma

        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"



        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        *** WARNING ***

        The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
          - "simpleuser"
          - "workers"

        Run prisma generate to generate Prisma Client.

        Prisma schema loaded from schema.prisma

        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"



        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        Run prisma generate to generate Prisma Client.
        "
      `)
    })
  })

  describe('with preview feature and views defined', () => {
    const { fixturePath } = setupPostgresForViewsIO()

    test('basic introspection', async () => {
      ctx.fixture(fixturePath)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          "public",
          "work",
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          "views/public/simpleuser.sql",
          "views/work/workers.sql",
        ]
      `)

      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
      expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
        "Prisma schema loaded from schema.prisma

        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"



        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        *** WARNING ***

        The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
          - "simpleuser"
          - "workers"

        Run prisma generate to generate Prisma Client.
        "
      `)
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
        await expect(result).resolves.toMatchInlineSnapshot(`""`)

        // the folders in `views` match the database schema names (public, work) of the views
        // defined in the `setup.sql` file
        const list = await ctx.fs.listAsync(viewsPath)
        expect(list).toMatchInlineSnapshot(`
          [
            "public",
            "work",
          ]
        `)

        const tree = await ctx.fs.findAsync({
          directories: false,
          files: true,
          recursive: true,
          matching: `${viewsPath}/**/*`,
        })
        const polishedTree = tree.map(pathToPosix)
        expect(polishedTree).toMatchSnapshot()

        const publicSimpleUserView = await ctx.fs.readAsync(`${viewsPath}/public/simpleuser.sql`)
        expect(publicSimpleUserView).toMatchInlineSnapshot(`
          "SELECT
            su.first_name,
            su.last_name
          FROM
            someuser su;"
        `)

        const workWorkersView = await ctx.fs.readAsync(`${viewsPath}/work/workers.sql`)
        expect(workWorkersView).toMatchInlineSnapshot(`
          "SELECT
            su.first_name,
            su.last_name,
            c.name AS company_name
          FROM
            (
              someuser su
              LEFT JOIN WORK.company c ON ((su.company_id = c.id))
            );"
        `)

        expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
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
          "empty-dir",
          "extraneous-file.sql",
          "README",
        ]
      `)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      // the folders in `views` match the database schema names (public, work) of the views
      // defined in the `setup.sql` file
      const list = await ctx.fs.listAsync('views')
      list?.sort((a, b) => a.localeCompare(b, 'en-US'))
      expect(list).toMatchInlineSnapshot(`
        [
          "extraneous-file.sql",
          "public",
          "README",
          "work",
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      tree?.sort((a, b) => a.localeCompare(b, 'en-US'))
      expect(tree).toMatchInlineSnapshot(`
        [
          "views/extraneous-file.sql",
          "views/public/simpleuser.sql",
          "views/README",
          "views/work/workers.sql",
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
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`undefined`)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`[]`)

      expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
        "Prisma schema loaded from schema.prisma

        Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql-views", schemas "public, work" at "localhost:5432"



        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        Run prisma generate to generate Prisma Client.
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    test('introspect with already existing files in "views"', async () => {
      ctx.fixture(path.join(fixturePath))

      await ctx.fs.dirAsync('views/extraneous-dir')
      await ctx.fs.fileAsync('views/extraneous-file.sql')
      const extraneousList = await ctx.fs.listAsync('views')
      expect(extraneousList).toMatchInlineSnapshot(`
        [
          "extraneous-dir",
          "extraneous-file.sql",
        ]
      `)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          "extraneous-dir",
          "extraneous-file.sql",
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          "views/extraneous-file.sql",
        ]
      `)
    })
  })
})
