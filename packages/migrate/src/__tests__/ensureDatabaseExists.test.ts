import { getSchemaPath, getSchema, getConfig, createDatabase } from '@prisma/sdk'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('can create database - sqlite', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', true, schemaPath)
  await expect(result).resolves.toMatchInlineSnapshot(`SQLite database dev.db created at file:dev.db`)
})

//
// Would need frop logic to be reproducible
// createDatabase is already tested in the sdk tests
//

// it('can create database - postgresql', async () => {
//   ctx.fixture('schema-only-postgresql')
//   const schemaPath = (await getSchemaPath())!
//   const result = ensureDatabaseExists('create', true, schemaPath)
//   await expect(result).resolves.toMatchInlineSnapshot(`undefined`)
// })

// it('can create database - sqlserver', async () => {
//   ctx.fixture('schema-only-sqlserver')
//   const schemaPath = (await getSchemaPath())!
//   const result = ensureDatabaseExists('create', true, schemaPath)
//   await expect(result).resolves.toMatchInlineSnapshot(`undefined`)
// })

// it('can create database - mysql', async () => {
//   ctx.fixture('schema-only-mysql')
//   const schemaPath = (await getSchemaPath())!
//   const result = ensureDatabaseExists('create', true, schemaPath)
//   await expect(result).resolves.toMatchInlineSnapshot(`undefined`)
// })
