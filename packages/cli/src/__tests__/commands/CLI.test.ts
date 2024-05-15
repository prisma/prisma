import { type BaseContext, jestConsoleContext, jestContext } from '@prisma/get-platform'
import { DbPull, MigrateCommand, MigrateDiff } from '@prisma/migrate'
import execa from 'execa'
import path from 'path'

import { CLI } from '../../CLI'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const cliInstance = CLI.new(
  {
    // init: Init.new(),
    migrate: MigrateCommand.new({
      diff: MigrateDiff.new(),
      //   dev: MigrateDev.new(),
      //   status: MigrateStatus.new(),
      //   resolve: MigrateResolve.new(),
      //   reset: MigrateReset.new(),
      //   deploy: MigrateDeploy.new(),
    }),
    // db: DbCommand.new({
    //   pull: DbPull.new(),
    //   push: DbPush.new(),
    //   // drop: DbDrop.new(),
    //   seed: DbSeed.new(),
    // }),
    /**
     * @deprecated since version 2.30.0, use `db pull` instead (renamed)
     */
    introspect: DbPull.new(),
    // dev: Dev.new(),
    // studio: Studio.new(),
    // generate: Generate.new(),
    // version: Version.new(),
    // validate: Validate.new(),
    // format: Format.new(),
    // telemetry: Telemetry.new(),
  },
  ['version', 'init', 'migrate', 'db', 'introspect', 'dev', 'studio', 'generate', 'validate', 'format', 'telemetry'],
)

it('no params should return help', async () => {
  const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

  await cliInstance.parse([])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('wrong flag', async () => {
  const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

  await cliInstance.parse(['--something'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

  await cliInstance.parse(['--help'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(cliInstance.parse(['doesnotexist'])).resolves.toThrow()
})

it('introspect should include deprecation warning', async () => {
  const result = cliInstance.parse(['introspect'])

  await expect(result).rejects.toMatchInlineSnapshot(`
    "Could not find a schema.prisma file that is required for this command.
    You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location"
  `)
  expect(ctx.mocked['console.log'].mock.calls).toHaveLength(0)
  expect(ctx.mocked['console.info'].mock.calls).toHaveLength(0)
  expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    "prisma:warn 
    prisma:warn The prisma introspect command is deprecated. Please use prisma db pull instead.
    prisma:warn "
  `)
  expect(ctx.mocked['console.error'].mock.calls).toHaveLength(0)
})

describe('e2e sqlite', () => {
  // We follow the steps in https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1#migration-workflows.

  async function runWranglerCLI(ctx: BaseContext, ...args: string[]) {
    return await execa('pnpm', ['wrangler', '--config', path.join(ctx.tmpDir, 'wrangler.toml'), ...args], {
      cwd: __dirname,
    })
  }

  async function createWranglerD1Migration(ctx: BaseContext, { name }: { name: string }) {
    return await runWranglerCLI(ctx, 'd1', 'migrations', 'create', 'D1_DATABASE', name)
  }

  async function applyWranglerD1Migration(ctx: BaseContext) {
    return await runWranglerCLI(ctx, 'd1', 'migrations', 'apply', 'D1_DATABASE', '--local')
  }

  async function executeWranglerD1Command(ctx: BaseContext, { command, json }: { command: string; json?: boolean }) {
    const args = ['d1', 'execute', 'D1_DATABASE', '--local', '--command', command]

    if (json) {
      args.push('--json')
    }

    return await runWranglerCLI(ctx, ...args)
  }

  describe('d1 migration workflow', () => {
    it('issue #24208', async () => {
      ctx.fixture('migrate/schema-sqlite-d1-24208')

      // Create D1 database
      const wranglerCreateD1 = await executeWranglerD1Command(ctx, { command: 'SELECT 1;' })
      expect(wranglerCreateD1.exitCode).toBe(0)

      // Create `init` migration file for D1 using `wrangler d1 migrations`
      const wranglerCreateInitMigration = await createWranglerD1Migration(ctx, { name: 'init' })
      expect(wranglerCreateInitMigration.exitCode).toBe(0)

      // Create `init` SQL migration using `prisma migrate diff`
      const prismaCreateInitMigration = cliInstance.parse([
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        './prisma/schema.prisma',
        '--script',
        '--output',
        './migrations/0001_init.sql',
      ])
      await expect(prismaCreateInitMigration).resolves.toMatchInlineSnapshot(`""`)

      // Print the `init` SQL migration file
      const initMigrationSQL = ctx.fs.readAsync('./migrations/0001_init.sql')
      await expect(initMigrationSQL).resolves.toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE "User" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "oldField" TEXT
        );

        -- CreateTable
        CREATE TABLE "Post" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME,
            "title" TEXT NOT NULL,
            "authorId" INTEGER NOT NULL,
            CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );

        -- CreateIndex
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
        "
      `)

      // Apply `init` migration to D1
      const wranglerExecuteInitMigration = await applyWranglerD1Migration(ctx)
      expect(wranglerExecuteInitMigration.exitCode).toBe(0)

      // Seed some data into D1.
      // Once we move the `PRIMARY KEY` from `User.id` to `User.count`, we would like to observe the `FOREIGN KEY` constraint failure,
      // demonstrating that Prisma migrations check the integrity of the data, and rollback the migration if the data is not consistent.

      const wranglerSeedUsers = await executeWranglerD1Command(ctx, {
        command: `INSERT INTO User ('id', 'email', 'name') VALUES (1, 'test@test.de', 'Test Test');`,
      })
      expect(wranglerSeedUsers.exitCode).toBe(0)

      const wranglerSeedPosts = await executeWranglerD1Command(ctx, {
        command: `INSERT INTO Post ('id', 'title', 'authorId') VALUES (1, 'Hello World', 1);`,
      })
      expect(wranglerSeedPosts.exitCode).toBe(0)

      //
      // Evolve the Prisma data model
      //

      // Create `rename_new_field` migration file for D1 using `wrangler d1 migrations`
      const wranglerAddCountToUserMigration = await createWranglerD1Migration(ctx, { name: 'rename_new_field' })
      expect(wranglerAddCountToUserMigration.exitCode).toBe(0)

      // Create `rename_new_field` migration SQL using `prisma migrate diff`
      const prismaCreateRenameNewFieldMigration = cliInstance.parse([
        'migrate',
        'diff',
        '--from-local-d1',
        '--to-schema-datamodel',
        './prisma/schema-1-rename-new-field.prisma',
        '--script',
        '--output',
        './migrations/0002_rename_new_field.sql',
      ])
      await expect(prismaCreateRenameNewFieldMigration).resolves.toMatchInlineSnapshot(`""`)

      // Print the `rename_new_field` SQL migration file
      const addRenameNewFieldMigrationSQL = ctx.fs.readAsync('./migrations/0002_rename_new_field.sql')
      await expect(addRenameNewFieldMigrationSQL).resolves.toMatchInlineSnapshot(`
        "-- RedefineTables
        PRAGMA foreign_keys=OFF;
        CREATE TABLE "new_User" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "newField" TEXT
        );
        INSERT INTO "new_User" ("createdAt", "email", "id", "name") SELECT "createdAt", "email", "id", "name" FROM "User";
        DROP TABLE "User";
        ALTER TABLE "new_User" RENAME TO "User";
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
        PRAGMA foreign_key_check("User");
        PRAGMA foreign_keys=ON;
        "
      `)

      // Apply `rename_new_field` migration to D1
      try {
        await applyWranglerD1Migration(ctx)
        expect(true).toBe(false) // unreachable
      } catch (error) {
        const e = error as execa.ExecaError

        console.dir(e.stderr)
      }
    }, 60_000)

    it('incremental changes succeed until foreign keys are violated', async () => {
      ctx.fixture('migrate/schema-sqlite-d1')

      // Create D1 database
      const wranglerCreateD1 = await executeWranglerD1Command(ctx, { command: 'SELECT 1;' })
      expect(wranglerCreateD1.exitCode).toBe(0)

      // Create `init` migration file for D1 using `wrangler d1 migrations`
      const wranglerCreateInitMigration = await createWranglerD1Migration(ctx, { name: 'init' })
      expect(wranglerCreateInitMigration.exitCode).toBe(0)

      // Create `init` SQL migration using `prisma migrate diff`
      const prismaCreateInitMigration = cliInstance.parse([
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        './prisma/schema.prisma',
        '--script',
        '--output',
        './migrations/0001_init.sql',
      ])
      await expect(prismaCreateInitMigration).resolves.toMatchInlineSnapshot(`""`)

      // Print the `init` SQL migration file
      const initMigrationSQL = ctx.fs.readAsync('./migrations/0001_init.sql')
      await expect(initMigrationSQL).resolves.toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE "Post" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "title" TEXT NOT NULL,
            "content" TEXT,
            "published" BOOLEAN NOT NULL DEFAULT false,
            "authorId" INTEGER NOT NULL,
            CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );

        -- CreateTable
        CREATE TABLE "User" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "email" TEXT NOT NULL,
            "name" TEXT
        );

        -- CreateIndex
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
        "
      `)

      // Apply `init` migration to D1
      const wranglerExecuteInitMigration = await applyWranglerD1Migration(ctx)
      expect(wranglerExecuteInitMigration.exitCode).toBe(0)

      //
      // Evolve the Prisma data model
      //

      // Create `add_count_to_user_table` migration file for D1 using `wrangler d1 migrations`
      const wranglerAddCountToUserMigration = await createWranglerD1Migration(ctx, { name: 'add_count_to_user_table' })
      expect(wranglerAddCountToUserMigration.exitCode).toBe(0)

      // Create `add_count_to_user_table` migration SQL using `prisma migrate diff`
      const prismaCreateAddCountToUserTableMigration = cliInstance.parse([
        'migrate',
        'diff',
        '--from-local-d1',
        '--to-schema-datamodel',
        './prisma/schema-1-add-count-to-user.prisma',
        '--script',
        '--output',
        './migrations/0002_add_count_to_user_table.sql',
      ])
      await expect(prismaCreateAddCountToUserTableMigration).resolves.toMatchInlineSnapshot(`""`)

      // Print the `add_count_to_user_table` SQL migration file
      const addCountToUserTableMigrationSQL = ctx.fs.readAsync('./migrations/0002_add_count_to_user_table.sql')
      await expect(addCountToUserTableMigrationSQL).resolves.toMatchInlineSnapshot(`
        "-- RedefineTables
        PRAGMA foreign_keys=OFF;
        CREATE TABLE "new_User" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "count" INTEGER NOT NULL
        );
        INSERT INTO "new_User" ("email", "id", "name") SELECT "email", "id", "name" FROM "User";
        DROP TABLE "User";
        ALTER TABLE "new_User" RENAME TO "User";
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
        PRAGMA foreign_key_check("User");
        PRAGMA foreign_keys=ON;
        "
      `)

      // Apply `add_count_to_user_table` migration to D1
      const wranglerExecuteAddCountToUserTableMigration = await applyWranglerD1Migration(ctx)
      expect(wranglerExecuteAddCountToUserTableMigration.exitCode).toBe(0)

      // Seed some data into D1.
      // Once we move the `PRIMARY KEY` from `User.id` to `User.count`, we would like to observe the `FOREIGN KEY` constraint failure,
      // demonstrating that Prisma migrations check the integrity of the data, and rollback the migration if the data is not consistent.

      const wranglerSeedUsers = await executeWranglerD1Command(ctx, {
        command: `INSERT INTO User ('id', 'count', 'email', 'name') VALUES (1, 2, 'schiabel@prisma.io', 'Schiabel');`,
      })
      expect(wranglerSeedUsers.exitCode).toBe(0)

      const wranglerSeedPosts = await executeWranglerD1Command(ctx, {
        command: `INSERT INTO Post ('id', 'title', 'authorId') VALUES (1, 'Post 1', '1');`,
      })
      expect(wranglerSeedPosts.exitCode).toBe(0)

      // Create `change_user_id_to_count` migration file for D1 using `wrangler d1 migrations`
      const wranglerChangeUserIdToCountMigration = await createWranglerD1Migration(ctx, {
        name: 'change_user_id_to_count',
      })
      expect(wranglerChangeUserIdToCountMigration.exitCode).toBe(0)

      // Create `add_count_to_user_table` migration SQL using `prisma migrate diff`
      const prismaCreateChangeUserIdToCountMigration = cliInstance.parse([
        'migrate',
        'diff',
        '--from-local-d1',
        '--to-schema-datamodel',
        './prisma/schema-2-change-user-id-to-count.prisma',
        '--script',
        '--output',
        './migrations/0003_change_user_id_to_count.sql',
      ])
      await expect(prismaCreateChangeUserIdToCountMigration).resolves.toMatchInlineSnapshot(`""`)

      // Print the `add_count_to_user_table` SQL migration file.
      // Note: this is commented out because the order of the output of `prisma migrate diff` is not deterministic 😔.
      // const changeUserIdToCountMigrationSQL = ctx.fs.readAsync('./migrations/0003_change_user_id_to_count.sql')
      // await expect(changeUserIdToCountMigrationSQL).resolves.toMatchInlineSnapshot(`
      //   "-- RedefineTables
      //   PRAGMA foreign_keys=OFF;
      //   CREATE TABLE "new_User" (
      //       "id" INTEGER NOT NULL,
      //       "email" TEXT NOT NULL,
      //       "name" TEXT,
      //       "count" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
      //   );
      //   INSERT INTO "new_User" ("count", "email", "id", "name") SELECT "count", "email", "id", "name" FROM "User";
      //   DROP TABLE "User";
      //   ALTER TABLE "new_User" RENAME TO "User";
      //   CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
      //   CREATE TABLE "new_Post" (
      //       "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      //       "title" TEXT NOT NULL,
      //       "content" TEXT,
      //       "published" BOOLEAN NOT NULL DEFAULT false,
      //       "authorId" INTEGER NOT NULL,
      //       CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("count") ON DELETE RESTRICT ON UPDATE CASCADE
      //   );
      //   INSERT INTO "new_Post" ("authorId", "content", "id", "published", "title") SELECT "authorId", "content", "id", "published", "title" FROM "Post";
      //   DROP TABLE "Post";
      //   ALTER TABLE "new_Post" RENAME TO "Post";
      //   PRAGMA foreign_key_check("User");
      //   PRAGMA foreign_key_check("Post");
      //   PRAGMA foreign_keys=ON;
      //   "
      // `)

      // Apply `add_count_to_user_table` migration to D1
      try {
        await applyWranglerD1Migration(ctx)
        expect(true).toBe(false) // unreachable
      } catch (error) {
        const e = error as execa.ExecaError

        // There are two possible `FOREIGN KEY` constraint failure messages that could appear, depending on the order of the output of `prisma migrate diff`.
        const possibleMatches = [
          'FOREIGN KEY constraint failed',
          'foreign key mismatch - "new_Post" referencing "User"',
        ]
        expect(possibleMatches.some((match) => e.stderr.includes(match))).toBe(true)
      }

      // Verify that the `User` table is still in the original state, i.e., that a `ROLLBACK` of the previous migration has occurred.
      const wranglerVerifyUserTable = await executeWranglerD1Command(ctx, {
        command: 'PRAGMA table_info(User);',
        json: true,
      })

      const wranglerVerifyUserTableAsJSON = JSON.parse(wranglerVerifyUserTable.stdout)
      expect(wranglerVerifyUserTableAsJSON).toMatchObject([
        {
          results: [
            {
              cid: 0,
              name: 'id',
              type: 'INTEGER',
              notnull: 1,
              dflt_value: 'null',
              pk: 1,
            },
            {
              cid: 1,
              name: 'email',
              type: 'TEXT',
              notnull: 1,
              dflt_value: 'null',
              pk: 0,
            },
            {
              cid: 2,
              name: 'name',
              type: 'TEXT',
              notnull: 0,
              dflt_value: 'null',
              pk: 0,
            },
            {
              cid: 3,
              name: 'count',
              type: 'INTEGER',
              notnull: 1,
              dflt_value: 'null',
              pk: 0,
            },
          ],
          success: true,
        },
      ])
    }, 60_000)
  })
})
