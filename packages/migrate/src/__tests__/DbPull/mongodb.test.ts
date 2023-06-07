// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'

import { DbPull } from '../../commands/DbPull'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

describeIf(!process.env.TEST_SKIP_MONGODB)('MongoDB', () => {
  const MONGO_URI = process.env.TEST_MONGO_URI_MIGRATE!

  if (isMacOrWindowsCI) {
    jest.setTimeout(60_000)
  }

  test('basic introspection', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/no-model.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/no-model.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/no-model.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Model: "users", field: "numberOrString1", original data type: "Json"

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
        - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --force (existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/schema.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Model: "users", field: "numberOrString1", original data type: "Json"

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
        - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      type UsersHobbies {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString2 Json?
        objects         UsersHobbiesObjects[]
        tags            String[]
      }

      type UsersHobbiesObjects {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString3 Json
        tags            String[]
      }

      model users {
        id              String         @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         UsersHobbies[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - Model: "users", field: "numberOrString1", original data type: "Json"
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
      //   - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=0 (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print', '--composite-type-depth=0'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      model users {
        id              String  @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         Json[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            // *** WARNING ***
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Model: "users", field: "numberOrString1", original data type: "Json"
            // 
        `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=1 (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print', '--composite-type-depth=1'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      type UsersHobbies {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString2 Json?
        objects         Json[]
        tags            String[]
      }

      model users {
        id              String         @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         UsersHobbies[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            // *** WARNING ***
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Model: "users", field: "numberOrString1", original data type: "Json"
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
            // 
        `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --force --composite-type-depth=-1 (existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force', '--composite-type-depth=-1'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/schema.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Model: "users", field: "numberOrString1", original data type: "Json"

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
        - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=-1 (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print', '--composite-type-depth=-1'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      type UsersHobbies {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString2 Json?
        objects         UsersHobbiesObjects[]
        tags            String[]
      }

      type UsersHobbiesObjects {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString3 Json
        tags            String[]
      }

      model users {
        id              String         @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         UsersHobbies[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            // *** WARNING ***
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Model: "users", field: "numberOrString1", original data type: "Json"
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
            //   - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"
            // 
        `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', MONGO_URI])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

            // *** WARNING ***
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Model: "users", field: "numberOrString1", original data type: "Json"
            // 
            // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
            //   - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
            //   - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"
            // 
        `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // In this case it should not error and the line `Datasource "x"` not be printed
  test('introspection --url - only generator defined', async () => {
    ctx.fixture('schema-only-mongodb/only-generator')
    const introspect = new DbPull()
    const result = introspect.parse(['--url', MONGO_URI])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).not.toContain(`Datasource `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Prisma schema loaded from schema.prisma`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting

      ✔ Introspected 1 model and 2 embedded documents and wrote them into schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Model: "users", field: "numberOrString1", original data type: "Json"

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
        - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection with --force', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/schema.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Model: "users", field: "numberOrString1", original data type: "Json"

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - Composite type: "UsersHobbies", field: "numberOrString2", chosen data type: "Json"
        - Composite type: "UsersHobbiesObjects", field: "numberOrString3", chosen data type: "Json"

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('re-introspection should error (not supported) (existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Iterating on one schema using re-introspection with db pull is currently not supported with MongoDB provider.
            You can explicitly ignore and override your current local schema file with prisma db pull --force
            Some information will be lost (relations, comments, mapped fields, @ignore...), follow https://github.com/prisma/prisma/issues/9585 for more info.
          `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
