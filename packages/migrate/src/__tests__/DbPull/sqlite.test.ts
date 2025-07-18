import { DbPull } from '../../commands/DbPull'
import { describeMatrix, noDriverAdapters, sqliteOnly } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = createDefaultTestContext()

describeMatrix({ providers: { d1: true }, driverAdapters: {} }, 'D1', () => {
  const urlValueRegex = /url\s*=\s*".*"/

  test('should succeed when --local-d1 and a single local Cloudflare D1 database exists', async () => {
    ctx.fixture('cloudflare-d1-one-db')

    const introspect = new DbPull()
    const result = introspect.parse(['--local-d1', '--print'], await ctx.config())

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    // Example values:
    // Windows
    // 'file:.wrangler//state//v3//d1//miniflare-D1DatabaseObject//5d11bcce386042472d19a6a4f58e40041ebc5932c972e1449cbf404f3e3c4a7a.sqlite'
    // macOS
    // 'file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/5d11bcce386042472d19a6a4f58e40041ebc5932c972e1449cbf404f3e3c4a7a.sqlite'
    expect(ctx.normalizedCapturedStdout().replace(urlValueRegex, 'url = "REPLACED_BY_TEST"')).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["driverAdapters"]
      }

      datasource db {
        provider = "sqlite"
        url = "REPLACED_BY_TEST"
      }

      model Post {
        id       Int    @id @default(autoincrement())
        title    String
        authorId Int
        User     User   @relation(fields: [authorId], references: [id])
      }

      model User {
        id     Int     @id @default(autoincrement())
        email  String  @unique
        count1 Int
        name   String?
        Post   Post[]
      }

      "
    `)
  })

  test('should succeed when reintrospecting with --local-d1 and a single local Cloudflare D1 database exists', async () => {
    ctx.fixture('re-introspection/sqlite/cloudflare-d1-one-db')

    const introspect = new DbPull()
    const result = introspect.parse(['--local-d1'], await ctx.config())

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/schema.prisma
      ✔ Introspected 2 models and wrote them into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      Without the driverAdapters preview feature, the schema introspected via the --local-d1 flag will not work with @prisma/client.
      "
    `)
  })
})

describeMatrix(sqliteOnly, 'common/sqlite', () => {
  describe('using Prisma Config', () => {
    it('--url is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')

      try {
        await DbPull.new().parse(['--url', 'file:./dev.db'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --url flag to the prisma db pull command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })

    it('--local-d1 is not supported', async () => {
      ctx.fixture('prisma-config-validation/sqlite-d1')
      try {
        await DbPull.new().parse(['--local-d1'], await ctx.config())
      } catch (error) {
        const e = error as Error & { code?: number }

        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          "
          Passing the --local-d1 flag to the prisma db pull command is not supported when
          defining an adapter in Prisma config file (e.g., \`prisma.config.ts\`).

          More information about this limitation: https://pris.ly/d/schema-engine-limitations
          "
        `)
      }
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }

      model Post {
        authorId  Int
        content   String?
        createdAt DateTime @default(now())
        id        Int      @id @default(autoincrement())
        published Boolean  @default(false)
        title     String
        author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
      }

      model Profile {
        bio    String?
        id     Int     @id @default(autoincrement())
        userId Int     @unique(map: "Profile.userId")
        user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
      }

      model User {
        email   String   @unique(map: "User.email")
        id      Int      @id @default(autoincrement())
        name    String?
        posts   Post[]
        profile Profile?
      }

      "
    `)
  })

  test('introspection --force', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--force'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }

      model Post {
        authorId  Int
        content   String?
        createdAt DateTime @default(now())
        id        Int      @id @default(autoincrement())
        published Boolean  @default(false)
        title     String
        User      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
      }

      model Profile {
        bio    String?
        id     Int     @id @default(autoincrement())
        userId Int     @unique(map: "Profile.userId")
        User   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
      }

      model User {
        email   String   @unique(map: "User.email")
        id      Int      @id @default(autoincrement())
        name    String?
        Post    Post[]
        Profile Profile?
      }

      "
    `)
  })

  describeMatrix(noDriverAdapters, 'using --url', () => {
    test('basic introspection with --url', async () => {
      ctx.fixture('introspection/sqlite')
      const introspect = new DbPull()
      const result = introspect.parse(['--print', '--url', 'file:./dev.db'], await ctx.config())
      await expect(result).resolves.toBe('')

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "sqlite"
          url      = "file:./dev.db"
        }

        model Post {
          authorId  Int
          content   String?
          createdAt DateTime @default(now())
          id        Int      @id @default(autoincrement())
          published Boolean  @default(false)
          title     String
          author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
        }

        model Profile {
          bio    String?
          id     Int     @id @default(autoincrement())
          userId Int     @unique(map: "Profile.userId")
          user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
        }

        model User {
          email   String   @unique(map: "User.email")
          id      Int      @id @default(autoincrement())
          name    String?
          posts   Post[]
          profile Profile?
        }

        "
      `)
    })

    test('basic introspection with schema and --url missing file: prefix should fail', async () => {
      ctx.fixture('introspection/sqlite')
      const introspect = new DbPull()
      const result = introspect.parse(['--print', '--url', 'withoutfileprefix.db'], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`"Unknown protocol withoutfileprefix.db:"`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
    })

    test('basic introspection without schema and with --url missing "file:" prefix should fail', async () => {
      const introspect = new DbPull()
      const result = introspect.parse(['--print', '--url', 'withoutfileprefix.db'], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`"Unknown protocol withoutfileprefix.db:"`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
    })

    test('basic introspection with invalid --url if schema is unspecified', async () => {
      const introspect = new DbPull()
      const result = introspect.parse(['--print', '--url', 'invalidstring'], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`"Unknown protocol invalidstring:"`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
    })

    test('should succeed when schema and db do match using --url', async () => {
      ctx.fixture('introspect')
      const result = DbPull.new().parse(['--url=file:../dev.db'], await ctx.config())
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
              "Prisma schema loaded from prisma/schema.prisma
              Datasource "db": SQLite database "dev.db" <location placeholder>

              - Introspecting
              ✔ Introspected 3 models and wrote them into prisma/schema.prisma in XXXms
                    
              Run prisma generate to generate Prisma Client.
              "
          `)
    })

    test('when both --url and --schema are used, --url is relative to schema', async () => {
      ctx.fixture('empty-schema-db-subfolder')
      const result = DbPull.new().parse(
        ['--url=file:../db/dev.db', '--schema=schema/schema.prisma', '--print'],
        await ctx.config(),
      )
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
              "datasource db {
                provider = "sqlite"
                url      = "file:../db/dev.db"
              }

              model Post {
                authorId  Int
                content   String?
                createdAt DateTime @default(now())
                id        Int      @id @default(autoincrement())
                published Boolean  @default(false)
                title     String
                User      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
              }

              model Profile {
                bio    String?
                id     Int     @id @default(autoincrement())
                userId Int     @unique(map: "Profile.userId")
                User   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
              }

              model User {
                email   String   @unique(map: "User.email")
                id      Int      @id @default(autoincrement())
                name    String?
                Post    Post[]
                Profile Profile?
              }

              "
          `)
    })

    test('basic introspection with invalid --url - empty host', async () => {
      const introspect = new DbPull()
      const result = introspect.parse(['--print', '--url', 'postgresql://root:prisma@/prisma'], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              "P1013

              The provided database string is invalid. empty host in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
              "
          `)
    })
  })

  it('should succeed when schema and db do match', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse([], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/schema.prisma
      ✔ Introspected 3 models and wrote them into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      "
    `)
  })

  it('should succeed and keep changes to valid schema and output warnings', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse(['--schema=./prisma/reintrospection.prisma'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/reintrospection.prisma
      Datasource "db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/reintrospection.prisma
      ✔ Introspected 3 models and wrote them into prisma/reintrospection.prisma in XXXms
            
      *** WARNING ***

      These models were enriched with \`@@map\` information taken from the previous Prisma schema:
        - "AwesomeNewPost"
        - "AwesomeProfile"
        - "AwesomeUser"

      Run prisma generate to generate Prisma Client.
      "
    `)

    expect(ctx.fs.read('prisma/reintrospection.prisma')).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
        output   = "../generated/client"
      }

      datasource db {
        provider = "sqlite"
        url      = "file:../dev.db"
      }

      model AwesomeUser {
        email    String           @unique(map: "User.email")
        id       Int              @id @default(autoincrement())
        name     String?
        newPosts AwesomeNewPost[]
        profile  AwesomeProfile?

        @@map("User")
      }

      model AwesomeNewPost {
        authorId  Int
        content   String?
        createdAt DateTime    @default(now())
        id        Int         @id @default(autoincrement())
        published Boolean     @default(false)
        title     String
        author    AwesomeUser @relation(fields: [authorId], references: [id], onDelete: Cascade)

        @@map("Post")
      }

      model AwesomeProfile {
        bio    String?
        id     Int         @id @default(autoincrement())
        userId Int         @unique(map: "Profile.userId")
        user   AwesomeUser @relation(fields: [userId], references: [id], onDelete: Cascade)

        @@map("Profile")
      }
      "
    `)
  })

  it('should succeed and keep changes to valid schema and output warnings when using --print', async () => {
    ctx.fixture('introspect')
    const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
    const result = DbPull.new().parse(['--print', '--schema=./prisma/reintrospection.prisma'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
        output   = "../generated/client"
      }

      datasource db {
        provider = "sqlite"
        url      = "file:../dev.db"
      }

      model AwesomeUser {
        email    String           @unique(map: "User.email")
        id       Int              @id @default(autoincrement())
        name     String?
        newPosts AwesomeNewPost[]
        profile  AwesomeProfile?

        @@map("User")
      }

      model AwesomeNewPost {
        authorId  Int
        content   String?
        createdAt DateTime    @default(now())
        id        Int         @id @default(autoincrement())
        published Boolean     @default(false)
        title     String
        author    AwesomeUser @relation(fields: [authorId], references: [id], onDelete: Cascade)

        @@map("Post")
      }

      model AwesomeProfile {
        bio    String?
        id     Int         @id @default(autoincrement())
        userId Int         @unique(map: "Profile.userId")
        user   AwesomeUser @relation(fields: [userId], references: [id], onDelete: Cascade)

        @@map("Profile")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      // *** WARNING ***
      // 
      // These models were enriched with \`@@map\` information taken from the previous Prisma schema:
      //   - "AwesomeNewPost"
      //   - "AwesomeProfile"
      //   - "AwesomeUser"
      // "
    `)

    expect(ctx.fs.read('prisma/reintrospection.prisma')).toStrictEqual(originalSchema)
  })

  it('should succeed when schema and db do not match', async () => {
    ctx.fixture('existing-db-histories-diverge')
    const result = DbPull.new().parse([], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/schema.prisma
      ✔ Introspected 3 models and wrote them into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      "
    `)
  })

  it('should fail when db is missing', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = DbPull.new().parse([], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "
      P1003 The introspected database does not exist:

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to an existing database.

      Then you can run prisma db pull again. 
      "
    `)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/schema.prisma
      ✖ Introspecting based on datasource defined in prisma/schema.prisma
      "
    `)
  })

  it('should fail when db is empty', async () => {
    ctx.fixture('schema-only-sqlite')
    ctx.fs.write('dev.db', '')
    const result = DbPull.new().parse([], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "
      P4001 The introspected database was empty:

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a table in your database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

      Then you can run prisma db pull again. 
      "
    `)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/schema.prisma
      ✖ Introspecting based on datasource defined in prisma/schema.prisma
      "
    `)
  })

  it('should fail when Prisma schema is missing', async () => {
    const result = DbPull.new().parse([], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Could not find a schema.prisma file that is required for this command.
      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location"
    `)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
  })

  it('should fail when schema is invalid', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma'], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P1012

      error: Error validating model "something": Each model must have at least one unique criteria that has only required fields. Either mark a single field with \`@id\`, \`@unique\` or add a multi field criterion with \`@@id([])\` or \`@@unique([])\` to the model.
        -->  prisma/invalid.prisma:11
         | 
      10 | 
      11 | model something {
      12 |   id Int
      13 | }
         | 


      Introspection failed as your current Prisma schema file is invalid

      Please fix your current schema manually (using either prisma validate or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
      Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.
      "
    `)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/invalid.prisma
      Datasource "db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/invalid.prisma
      ✖ Introspecting based on datasource defined in prisma/invalid.prisma
      
      "
    `)
  })

  it('should succeed when schema is invalid and using --force', async () => {
    ctx.fixture('introspect')

    const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma', '--force'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/invalid.prisma
      Datasource "db": SQLite database "dev.db" <location placeholder>

      - Introspecting based on datasource defined in prisma/invalid.prisma
      ✔ Introspected 3 models and wrote them into prisma/invalid.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      "
    `)

    expect(ctx.fs.read('prisma/invalid.prisma')).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
        output   = "../generated/client"
      }

      datasource db {
        provider = "sqlite"
        url      = "file:../dev.db"
      }

      model Post {
        authorId  Int
        content   String?
        createdAt DateTime @default(now())
        id        Int      @id @default(autoincrement())
        published Boolean  @default(false)
        title     String
        User      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
      }

      model Profile {
        bio    String?
        id     Int     @id @default(autoincrement())
        userId Int     @unique(map: "Profile.userId")
        User   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
      }

      model User {
        email   String   @unique(map: "User.email")
        id      Int      @id @default(autoincrement())
        name    String?
        Post    Post[]
        Profile Profile?
      }
      "
    `)
  })
})
