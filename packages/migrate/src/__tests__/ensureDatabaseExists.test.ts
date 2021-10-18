import { getSchemaPath } from '@prisma/sdk'
import { ensureDatabaseExists } from '../ensureDatabaseExists'
import { consoleContext, Context } from '../../__tests__/__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('can create database - sqlite', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', true, schemaPath)
  await expect(result).resolves.toMatchInlineSnapshot(`SQLite database dev.db created at file:dev.db`)
})

it('can create database - postgresql', async () => {
  ctx.fixture('schema-only-postgresql')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', true, schemaPath)
  await expect(result).resolves.toMatchInlineSnapshot(`undefined`)
})

it('can create database - sqlserver', async () => {
  ctx.fixture('schema-only-sqlserver')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', true, schemaPath)
  await expect(result).resolves.toMatchInlineSnapshot(`undefined`)
})

it('can create database - mysql', async () => {
  ctx.fixture('schema-only-mysql')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', true, schemaPath)
  await expect(result).resolves.toMatchInlineSnapshot(`undefined`)
})

it('can create a database - mongodb', async () => {
  ctx.fixture('schema-only-mongodb')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', true, schemaPath)
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `"mongodb" provider is not supported with this command. For more info see https://www.prisma.io/docs/concepts/database-connectors/mongodb`,
  )
})
