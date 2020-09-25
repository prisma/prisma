import fs from 'fs-jetpack'
import { MigrateInit } from '../commands/MigrateInit'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('init should create the migrations folder', async () => {
  ctx.fixture('schema-only')
  const result = MigrateInit.new().parse(['--experimental'])
  await expect(result).resolves.toMatchInlineSnapshot(
    `

          Initialization complete.

          Run yarn prisma migrate --experimental to create your first migration

        `,
  )
  expect(
    ctx.mocked['console.error'].mock.calls.join('\n'),
  ).toMatchInlineSnapshot(``)

  expect(fs.inspect('prisma/migrations')).toMatchInlineSnapshot(`
    Object {
      name: migrations,
      type: dir,
    }
  `)
})

it('init should fail if no schema file', async () => {
  ctx.fixture('empty')
  const result = MigrateInit.new().parse(['--experimental'])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})
