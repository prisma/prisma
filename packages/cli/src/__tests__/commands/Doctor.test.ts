import { jestConsoleContext, jestContext } from '@prisma/sdk'

import { Doctor } from '../../Doctor'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it.skip('doctor should succeed when schema and db do match', async () => {
  ctx.fixture('example-project')
  const result = Doctor.new().parse([])
  await expect(result).resolves.toEqual('Everything in sync 🔄')
  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(
    `👩‍⚕️🏥 Prisma Doctor checking the database...`,
  )
})

it('should fail when db is missing', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.remove('dev.db')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`P1003: Database dev.db does not exist at dev.db`)
})

it('should fail when Prisma schema is missing', async () => {
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})

it('should fail when db is empty', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.write('dev.db', '')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          P4001

          The introspected database was empty.

        `)
})

it('should fail when schema and db do not match', async () => {
  ctx.fixture('schema-db-out-of-sync')
  const result = Doctor.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingSnapshot(`


                    NewPost
                    ↪ Model is missing in database


                    User
                    ↪ Field newName is missing in database
                    ↪ Field newPosts is missing in database

                `)
})
