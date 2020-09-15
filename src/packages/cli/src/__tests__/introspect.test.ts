import { Introspect } from '@prisma/introspection'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should succeed when schema and db do match', async () => {
  ctx.fixture('introspect/prisma')
  const result = Introspect.new().parse([])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  console.log(ctx.mocked['console.log'].mock.calls)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'XXms'),
  ).toMatchInlineSnapshot(`

    Introspecting based on datasource defined in schema.prisma …

    ✔ Introspected 3 models and wrote them into schema.prisma in XXms
          
    Run prisma generate to generate Prisma Client.

  `)
})

it('should succeed when schema and db do match using --url', async () => {
  ctx.fixture('introspect/prisma')
  const result = Introspect.new().parse(['--url=file:./dev.db'])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  console.log(ctx.mocked['console.log'].mock.calls)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'XXms'),
  ).toMatchInlineSnapshot(`

    Introspecting …

    ✔ Introspected 3 models and wrote them into schema.prisma in XXms
          
    Run prisma generate to generate Prisma Client.

  `)
})

it('should succeed and keep changes to valid schema and output warnings', async () => {
  ctx.fixture('introspect')
  const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
  const result = Introspect.new().parse([
    '--schema=./prisma/reintrospection.prisma',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`

    Introspecting based on datasource defined in prisma/reintrospection.prisma …

    ✔ Introspected 3 models and wrote them into prisma/reintrospection.prisma in in XXms
          
    *** WARNING ***

    These models were enriched with \`@@map\` information taken from the previous Prisma schema.
    - Model "AwesomeNewPost"
    - Model "AwesomeProfile"
    - Model "AwesomeUser"

    Run prisma generate to generate Prisma Client.
  `)

  expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(
    ``,
  )

  expect(ctx.fs.read('prisma/reintrospection.prisma')).toStrictEqual(
    originalSchema,
  )
})

it('should succeed and keep changes to valid schema and output warnings when using --print', async () => {
  ctx.fixture('introspect')
  const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
  const result = Introspect.new().parse([
    '--print',
    '--schema=./prisma/reintrospection.prisma',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchSnapshot()

  expect(ctx.mocked['console.error'].mock.calls.join('\n'))
    .toMatchInlineSnapshot(`

                            *** WARNING ***

                            These models were enriched with \`@@map\` information taken from the previous Prisma schema.
                            - Model "AwesomeNewPost"
                            - Model "AwesomeProfile"
                            - Model "AwesomeUser"

              `)

  expect(ctx.fs.read('prisma/reintrospection.prisma')).toStrictEqual(
    originalSchema,
  )
})

it('should succeed when schema and db do not match', async () => {
  ctx.fixture('schema-db-out-of-sync')
  const result = Introspect.new().parse([])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`

    Introspecting based on datasource defined in schema.prisma …

    ✔ Introspected 3 models and wrote them into schema.prisma in in XXms
          
    Run prisma generate to generate Prisma Client.
  `)
})

it('should fail when db is missing', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.remove('dev.db')
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

          P4001 The introspected database was empty: 

          prisma introspect could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

          To fix this, you have two options:

          - manually create a table in your database (using SQL).
          - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

          Then you can run prisma introspect again. 

        `)
})

it('should fail when db is empty', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.write('dev.db', '')
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

          P4001 The introspected database was empty: 

          prisma introspect could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

          To fix this, you have two options:

          - manually create a table in your database (using SQL).
          - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

          Then you can run prisma introspect again. 

        `)
})

it('should fail when prisma schema is missing', async () => {
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `Either provide --schema or configure a path in your package.json in a \`prisma.schema\` field or make sure that you are in a folder with a schema.prisma file.`,
  )
})

it('should fail when schema is invalid', async () => {
  ctx.fixture('introspect')
  const result = Introspect.new().parse(['--schema=./prisma/invalid.prisma'])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          P1012 Introspection failed as your current Prisma schema file is invalid

          Please fix your current schema manually, use prisma validate to confirm it is valid and then run this command again.
          Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.

        `)
})

it('should succeed when schema is invalid and using --force', async () => {
  ctx.fixture('introspect')

  const result = Introspect.new().parse([
    '--schema=./prisma/invalid.prisma',
    '--force',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`

    Introspecting based on datasource defined in prisma/invalid.prisma …

    ✔ Introspected 3 models and wrote them into prisma/invalid.prisma in in XXms
          
    Run prisma generate to generate Prisma Client.
  `)

  expect(ctx.fs.read('prisma/invalid.prisma')).toMatchSnapshot()
})
