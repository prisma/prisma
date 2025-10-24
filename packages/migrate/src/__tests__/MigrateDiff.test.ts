// describeMatrix making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import os from 'node:os'
import path from 'node:path'

import { MigrateDiff } from '../commands/MigrateDiff'
import { setupCockroach, tearDownCockroach } from '../utils/setupCockroach'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'
import {
  allDriverAdapters,
  cockroachdbOnly,
  describeMatrix,
  mongodbOnly,
  noDriverAdapters,
  postgresOnly,
  sqlServerOnly,
} from './__helpers__/conditionalTests'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

const isWindows = os.platform() === 'win32'

describe('migrate diff', () => {
  describe('using Prisma Config', () => {
    it('--from-url is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--from-url', 'file:./dev.db'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --from-url flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--to-url is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--from-url', 'file:./dev.db'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --from-url flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--from-schema-datasource is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--from-schema-datasource', 'schema.prisma'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --from-schema-datasource flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--to-schema-datasource is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--to-schema-datasource', 'schema.prisma'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --to-schema-datasource flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--shadow-database-url is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--shadow-database-url', 'file:./dev.shadow.db'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --shadow-database-url flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--from-local-d1 is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--from-local-d1', 'file:./dev.shadow.db'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --from-local-d1 flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--to-local-d1 is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      expect.assertions(3)
      try {
        await MigrateDiff.new().parse(['--to-local-d1', 'file:./dev.shadow.db'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --to-local-d1 flag to the prisma migrate diff command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })
  })

  describeMatrix(noDriverAdapters, 'D1', () => {
    it('should succeed when --from-local-d1 and a single local Cloudflare D1 database exists', async () => {
      ctx.fixture('cloudflare-d1-one-db')

      const result = await MigrateDiff.new().parse(['--to-empty', '--from-local-d1', '--script'], await ctx.config())
      expect(result).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "Post";
        PRAGMA foreign_keys=on;

        -- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "User";
        PRAGMA foreign_keys=on;
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('should succeed when --to-local-d1 and a single local Cloudflare D1 database exists', async () => {
      ctx.fixture('cloudflare-d1-one-db')

      const result = await MigrateDiff.new().parse(['--from-empty', '--to-local-d1', '--script'], await ctx.config())
      expect(result).toMatchInlineSnapshot(`""`)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('should succeed when --from-url and a single local Cloudflare D1 database exists', async () => {
      ctx.fixture('cloudflare-d1-one-db')

      const url = path.join(
        ctx.fs.cwd(),
        '.wrangler',
        'state',
        'v3',
        'd1',
        'miniflare-D1DatabaseObject',
        '5d11bcce386042472d19a6a4f58e40041ebc5932c972e1449cbf404f3e3c4a7a.sqlite',
      )

      const result = await MigrateDiff.new().parse(
        ['--to-empty', '--from-url', `file:${url}`, '--script'],
        await ctx.config(),
      )
      expect(result).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "Post";
        PRAGMA foreign_keys=on;

        -- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "User";
        PRAGMA foreign_keys=on;
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('should succeed when --to-url and a single local Cloudflare D1 database exists', async () => {
      ctx.fixture('cloudflare-d1-one-db')

      const url = path.join(
        ctx.fs.cwd(),
        '.wrangler',
        'state',
        'v3',
        'd1',
        'miniflare-D1DatabaseObject',
        '5d11bcce386042472d19a6a4f58e40041ebc5932c972e1449cbf404f3e3c4a7a.sqlite',
      )

      const result = await MigrateDiff.new().parse(
        ['--from-empty', '--to-url', `file:${url}`, '--script'],
        await ctx.config(),
      )
      expect(result).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE "Post" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "title" TEXT NOT NULL,
            "authorId" INTEGER NOT NULL,
            FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );

        -- CreateTable
        CREATE TABLE "User" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "email" TEXT NOT NULL,
            "count1" INTEGER NOT NULL,
            "name" TEXT
        );

        -- CreateIndex
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })

    it('should fail when --from-local-d1 and several local Cloudflare D1 databases exist', async () => {
      ctx.fixture('cloudflare-d1-many-dbs')

      const result = MigrateDiff.new().parse(['--to-empty', '--from-local-d1', '--script'], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(
        `"Multiple Cloudflare D1 databases found in .wrangler/state/v3/d1/miniflare-D1DatabaseObject. Please manually specify the local D1 database with \`--from-url file:\`, without using the \`--from-local-d1\` flag."`,
      )
    })

    it('should fail when --to-local-d1 and several local Cloudflare D1 databases exist', async () => {
      ctx.fixture('cloudflare-d1-many-dbs')

      const result = MigrateDiff.new().parse(['--from-empty', '--to-local-d1', '--script'], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(
        `"Multiple Cloudflare D1 databases found in .wrangler/state/v3/d1/miniflare-D1DatabaseObject. Please manually specify the local D1 database with \`--to-url file:\`, without using the \`--to-local-d1\` flag."`,
      )
    })

    it('should fail when --from-local-d1 and no local Cloudflare D1 databases exists', async () => {
      ctx.fixture('cloudflare-d1-no-db')

      const result = MigrateDiff.new().parse(['--to-empty', '--from-local-d1', '--script'], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(
        `"No Cloudflare D1 databases found in .wrangler/state/v3/d1/miniflare-D1DatabaseObject. Did you run \`wrangler d1 create <DATABASE_NAME>\` and \`wrangler dev\`?"`,
      )
    })

    it('should fail when --to-local-d1 and no local Cloudflare D1 databases exists', async () => {
      ctx.fixture('cloudflare-d1-no-db')

      const result = MigrateDiff.new().parse(['--from-empty', '--to-local-d1', '--script'], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(
        `"No Cloudflare D1 databases found in .wrangler/state/v3/d1/miniflare-D1DatabaseObject. Did you run \`wrangler d1 create <DATABASE_NAME>\` and \`wrangler dev\`?"`,
      )
    })

    it('should fail when --from-local-d1 is used with --shadow-database-url', async () => {
      ctx.fixture('cloudflare-d1-one-db')

      const result = MigrateDiff.new().parse(
        ['--to-empty', '--from-local-d1', '--shadow-database-url', 'file:dev.db', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrow(
        `The flag \`--shadow-database-url\` is not compatible with \`--from-local-d1\` or \`--to-local-d1\`.`,
      )
    })

    it('should fail when --to-local-d1 is used with --shadow-database-url', async () => {
      ctx.fixture('cloudflare-d1-one-db')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-local-d1', '--shadow-database-url', 'file:dev.db', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrow(
        `The flag \`--shadow-database-url\` is not compatible with \`--from-local-d1\` or \`--to-local-d1\`.`,
      )
    })
  })

  describe('generic', () => {
    it('wrong flag', async () => {
      const commandInstance = MigrateDiff.new()
      const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

      await commandInstance.parse(['--something'], await ctx.config())
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('help flag', async () => {
      const commandInstance = MigrateDiff.new()
      const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

      await commandInstance.parse(['--help'], await ctx.config())
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('should fail if missing --from-... and --to-...', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse([], await ctx.config())
      await expect(result).rejects.toThrow()
    })

    it('should fail if only --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--from-empty'], await ctx.config())
      await expect(result).rejects.toThrow()
    })

    it('should fail if only --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--to-empty'], await ctx.config())
      await expect(result).rejects.toThrow()
    })

    it('should fail if more than 1 --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--from-empty', '--from-url=file:dev.db'], await ctx.config())
      await expect(result).rejects.toThrow()
    })

    it('should fail if more than 1 --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--to-empty', '--to-url=file:dev.db'], await ctx.config())
      await expect(result).rejects.toThrow()
    })

    it('should fail for empty/empty', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      try {
        await MigrateDiff.new().parse(['--from-empty', '--to-empty'], await ctx.config())
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "Could not determine the connector to use for diffing.

          "
        `)
      }
    })

    describeMatrix(noDriverAdapters, 'non driver adapter', () => {
      it('should fail if schema does no exists, --from-schema-datasource', async () => {
        ctx.fixture('empty')
        expect.assertions(2)

        try {
          await MigrateDiff.new().parse(
            ['--from-schema-datasource=./doesnoexists.prisma', '--to-empty'],
            await ctx.config(),
          )
        } catch (e) {
          expect(e.code).toEqual(undefined)
          expect(e.message).toMatchInlineSnapshot(
            `"Could not load \`--from-schema-datasource\` from provided path \`doesnoexists.prisma\`: file or directory not found"`,
          )
        }
      })
    })
  })

  describe('sqlite', () => {
    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-schema-datamodel=./prisma/schema.prisma'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        [+] Added tables
          - Blog
        "
      `)
    })

    it('should diff --from-empty --to-schema-datamodel=./prisma/schema (folder)', async () => {
      ctx.fixture('schema-folder-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-schema-datamodel=./prisma/schema'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        [+] Added tables
          - Blog
          - User
        "
      `)
    })

    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-schema-datamodel=./prisma/schema.prisma', '--script'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE "Blog" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "viewCount20" INTEGER NOT NULL
        );
        "
      `)
    })

    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        [-] Removed tables
          - Blog
        "
      `)
    })

    it('should diff --from-schema-datamodel=./prisma/schema (folder) --to-empty', async () => {
      ctx.fixture('schema-folder-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema', '--to-empty'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        [-] Removed tables
          - Blog
          - User
        "
      `)
    })

    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty', '--script'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "Blog";
        PRAGMA foreign_keys=on;
        "
      `)
    })

    it('should diff and write to output path', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty', '--script', '--output=./output.sql'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
      expect(ctx.fs.read('./output.sql')).toMatchInlineSnapshot(`
        "-- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "Blog";
        PRAGMA foreign_keys=on;
        "
      `)
    })

    it('should diff and write to output path if directory does not exist', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty', '--script', '--output=./subdir/output.sql'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
      expect(ctx.fs.read('./subdir/output.sql')).toMatchInlineSnapshot(`
        "-- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "Blog";
        PRAGMA foreign_keys=on;
        "
      `)
    })

    it('should fail with EACCES/EPERM when writing to output path which is read only', async () => {
      ctx.fixture('schema-only-sqlite')

      // Create a readonly file
      ctx.fs.write('./readonly.sql', 'test', {
        mode: 0o444,
      })
      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty', '--script', '--output=./readonly.sql'],
        await ctx.config(),
      )
      // Example error message:
      // macOS
      // [Error: EACCES: permission denied, open '/private/var/folders/qt/13pk8tq5113437vp1xr2l_s40000gn/T/f322d2ba6d947ea7c04312edde54aba3/readonly.sql']
      // Windows
      // EPERM: operation not permitted, open 'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\61b2f2248cfc996bff236aa42e874653\\readonly.sql'
      await expect(result).rejects.toThrow(isWindows ? 'EPERM' : 'EACCES')
    })

    describeMatrix(noDriverAdapters, 'non driver adapter', () => {
      it('should fail --from-empty --to-url=file:doesnotexists.db', async () => {
        ctx.fixture('schema-only-sqlite')

        const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:doesnotexists.db'], await ctx.config())
        await expect(result).rejects.toMatchInlineSnapshot(`
                  "P1003

                  Database \`doesnotexists.db\` does not exist
                  "
              `)
      })

      it('should fail --from-url=file:doesnotexists.db --to-empty ', async () => {
        ctx.fixture('schema-only-sqlite')

        const result = MigrateDiff.new().parse(['--from-url=file:doesnotexists.db', '--to-empty'], await ctx.config())
        await expect(result).rejects.toMatchInlineSnapshot(`
                  "P1003

                  Database \`doesnotexists.db\` does not exist
                  "
              `)
      })

      it('should fail if directory in path & sqlite file does not exist', async () => {
        ctx.fixture('schema-only-sqlite')

        const result = MigrateDiff.new().parse(
          ['--from-url=file:./something/doesnotexists.db', '--to-empty'],
          await ctx.config(),
        )
        await expect(result).rejects.toMatchInlineSnapshot(`
                  "P1003

                  Database \`doesnotexists.db\` does not exist
                  "
              `)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
      })

      it('should diff --from-empty --to-url=file:dev.db', async () => {
        ctx.fixture('introspection/sqlite')

        const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:dev.db'], await ctx.config())
        await expect(result).resolves.toMatchInlineSnapshot(`""`)
        expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
                  "
                  [+] Added tables
                    - Post
                    - Profile
                    - User
                    - _Migration

                  [*] Changed the \`Profile\` table
                    [+] Added unique index on columns (userId)

                  [*] Changed the \`User\` table
                    [+] Added unique index on columns (email)
                  "
              `)
      })

      it('should diff --from-empty --to-url=file:dev.db --script', async () => {
        ctx.fixture('introspection/sqlite')

        const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:dev.db', '--script'], await ctx.config())
        await expect(result).resolves.toMatchInlineSnapshot(`""`)
        expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
          "-- CreateTable
          CREATE TABLE "Post" (
              "authorId" INTEGER NOT NULL,
              "content" TEXT,
              "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "published" BOOLEAN NOT NULL DEFAULT false,
              "title" TEXT NOT NULL,
              FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );

          -- CreateTable
          CREATE TABLE "Profile" (
              "bio" TEXT,
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "userId" INTEGER NOT NULL,
              FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );

          -- CreateTable
          CREATE TABLE "User" (
              "email" TEXT NOT NULL,
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "name" TEXT
          );

          -- CreateTable
          CREATE TABLE "_Migration" (
              "revision" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "name" TEXT NOT NULL,
              "datamodel" TEXT NOT NULL,
              "status" TEXT NOT NULL,
              "applied" INTEGER NOT NULL,
              "rolled_back" INTEGER NOT NULL,
              "datamodel_steps" TEXT NOT NULL,
              "database_migration" TEXT NOT NULL,
              "errors" TEXT NOT NULL,
              "started_at" DATETIME NOT NULL,
              "finished_at" DATETIME
          );

          -- CreateIndex
          CREATE UNIQUE INDEX "Profile.userId" ON "Profile"("userId" ASC);

          -- CreateIndex
          CREATE UNIQUE INDEX "User.email" ON "User"("email" ASC);
          "
        `)
      })

      it('should pass if no schema file around', async () => {
        ctx.fixture('empty')
        // Create empty file, as the file needs to exists
        ctx.fs.write('dev.db', '')

        const result = MigrateDiff.new().parse(['--from-url=file:dev.db', '--to-url=file:dev.db'], await ctx.config())
        await expect(result).resolves.toMatchInlineSnapshot(`""`)
        expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
                  "No difference detected.
                  "
              `)
      })

      it('should exit with code 0 when diff is empty with --script', async () => {
        ctx.fixture('empty')
        // Create empty file, as the file needs to exists
        ctx.fs.write('dev.db', '')

        const result = MigrateDiff.new().parse(
          ['--from-empty', '--to-url=file:dev.db', '--script', '--exit-code'],
          await ctx.config(),
        )

        await expect(result).resolves.toMatchInlineSnapshot(`""`)
        expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
          "-- This is an empty migration.
          "
        `)
      })
    })

    describe('--exit-code', () => {
      it('should exit with code 2 when diff is not empty without --script', async () => {
        ctx.fixture('schema-only-sqlite')

        const result = MigrateDiff.new().parse(
          ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty', '--exit-code'],
          await ctx.config(),
        )

        await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 2"`)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
          "
          [-] Removed tables
            - Blog
          "
        `)

        expect(ctx.recordedExitCode()).toEqual(2)
      })

      it('should exit with code 2 when diff is not empty with --script', async () => {
        ctx.fixture('schema-only-sqlite')

        const result = MigrateDiff.new().parse(
          ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty', '--script', '--exit-code'],
          await ctx.config(),
        )

        await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 2"`)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
          "-- DropTable
          PRAGMA foreign_keys=off;
          DROP TABLE "Blog";
          PRAGMA foreign_keys=on;
          "
        `)

        expect(ctx.recordedExitCode()).toEqual(2)
      })
    })
  })

  describeMatrix(mongodbOnly, 'mongodb', () => {
    // it('should diff --from-url=$TEST_MONGO_URI --to-schema-datamodel=./prisma/schema.prisma', async () => {
    //   ctx.fixture('schema-only-mongodb')

    //   const result = MigrateDiff.new().parse([
    //     '--from-url',
    //     process.env.TEST_MONGO_URI!,
    //     // '--to-empty',
    //     '--to-schema-datamodel=./prisma/schema.prisma',
    //   ])
    //   await expect(result).resolves.toMatchInlineSnapshot(``)
    //   expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
    //     [+] Collection \`User\`

    //   `)
    // })

    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-schema-datamodel=./prisma/schema.prisma'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "[+] Collection \`User\`
        "
      `)
    })

    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse(
        ['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "No difference detected.
        "
      `)
    })

    it('should fail with not supported error with --script', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-schema-datamodel=./prisma/schema.prisma', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Rendering to a script is not supported on MongoDB.

        "
      `)
    })
  })

  describeMatrix(cockroachdbOnly, 'cockroachdb', () => {
    if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
      throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
    }
    const connectionString = process.env.TEST_COCKROACH_URI_MIGRATE?.replace('tests-migrate', 'tests-migrate-diff')
    const setupParams = {
      connectionString: connectionString!,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownCockroach(setupParams).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupCockroach(setupParams).catch((e) => {
        console.error(e)
      })

      ctx.setDatasource({ url: connectionString! })
    })

    afterEach(async () => {
      await tearDownCockroach(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-cockroachdb')

      const result = MigrateDiff.new().parse(
        ['--from-url', connectionString!, '--to-schema-datamodel=./prisma/schema.prisma', '--script'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE "Blog" (
            "id" INT4 NOT NULL,
            "viewCount20" INT4 NOT NULL,

            CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
        );
        "
      `)
    }, 10_000)

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-url', connectionString!, '--to-url=file:dev.db', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] called \`Option::unwrap()\` on a \`None\` value
        "
      `)
    })
  })

  describeMatrix(postgresOnly, 'postgres', () => {
    const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-diff')

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeEach(async () => {
      await setupPostgres(setupParams).catch((e) => {
        console.error(e)
      })
      ctx.setDatasource({ url: connectionString })
    })

    afterEach(async () => {
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-postgresql')

      const result = MigrateDiff.new().parse(
        ['--from-url', connectionString, '--to-schema-datamodel=./prisma/schema.prisma', '--script'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE "Blog" (
            "id" INTEGER NOT NULL,
            "viewCount20" INTEGER NOT NULL,

            CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
        );
        "
      `)
    })

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-url', connectionString, '--to-url=file:dev.db', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] called \`Option::unwrap()\` on a \`None\` value
        "
      `)
    })

    it('should exclude external tables from diff', async () => {
      ctx.fixture('external-tables')

      const result = MigrateDiff.new().parse(
        ['--from-empty', '--to-schema-datamodel=./schema.prisma'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      // Note the missing warnings about the User table as it is marked as external and won't be modified
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "No difference detected.
        "
      `)
    })
  })

  describeMatrix({ providers: { mysql: true }, driverAdapters: allDriverAdapters }, 'mysql', () => {
    const databaseName = 'tests-migrate-diff'
    const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace('tests-migrate', databaseName)

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupMysql(setupParams).catch((e) => {
        console.error(e)
      })

      ctx.setDatasource({ url: connectionString })
    })

    afterEach(async () => {
      await tearDownMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-mysql')

      const result = MigrateDiff.new().parse(
        ['--from-url', connectionString, '--to-schema-datamodel=./prisma/schema.prisma', '--script'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "-- CreateTable
        CREATE TABLE \`Blog\` (
            \`id\` INTEGER NOT NULL,
            \`viewCount20\` INTEGER NOT NULL,

            PRIMARY KEY (\`id\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        "
      `)
    })

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-url', connectionString, '--to-url=file:dev.db', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] Column native type missing in mysql_renderer::render_column_type()
        "
      `)
    })
  })

  describeMatrix(sqlServerOnly, 'sqlserver', () => {
    if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_JDBC_URI_MIGRATE) {
      throw new Error('You must set a value for process.env.TEST_MSSQL_JDBC_URI_MIGRATE. See TESTING.md')
    }
    const databaseName = 'tests-migrate-diff'
    const jdbcConnectionString = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace('tests-migrate', databaseName)

    const setupParams: SetupParams = {
      connectionString: process.env.TEST_MSSQL_URI!,
      dirname: '',
    }

    beforeAll(async () => {
      await tearDownMSSQL(setupParams, databaseName).catch((e) => {
        console.error(e)
      })
    })

    beforeEach(async () => {
      await setupMSSQL(setupParams, databaseName).catch((e) => {
        console.error(e)
      })

      const shadowDatabaseUrl = process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE?.replace(
        'tests-migrate-shadowdb',
        `${databaseName}-shadowdb`,
      )
      ctx.setDatasource({ url: jdbcConnectionString!, shadowDatabaseUrl })
    })

    afterEach(async () => {
      await tearDownMSSQL(setupParams, databaseName).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlserver')

      const result = MigrateDiff.new().parse(
        ['--from-url', jdbcConnectionString!, '--to-schema-datamodel=./prisma/schema.prisma', '--script'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "BEGIN TRY

        BEGIN TRAN;

        -- CreateTable
        CREATE TABLE [dbo].[Blog] (
            [id] INT NOT NULL,
            [viewCount20] INT NOT NULL,
            CONSTRAINT [Blog_pkey] PRIMARY KEY CLUSTERED ([id])
        );

        COMMIT TRAN;

        END TRY
        BEGIN CATCH

        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRAN;
        END;
        THROW

        END CATCH
        "
      `)
    })

    it('should fail for 2 different connectors --from-url=jdbcConnectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(
        ['--from-url', jdbcConnectionString!, '--to-url=file:dev.db', '--script'],
        await ctx.config(),
      )
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] Missing column native type in mssql_renderer::render_column_type()
        "
      `)
    })
  })
})
