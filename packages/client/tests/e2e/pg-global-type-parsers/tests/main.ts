import { Pool } from 'pg'

test('node-postgres global type parsers should not be changed by `@prisma/adapter-pg`', async () => {
  const pgPool = new Pool({ connectionString: process.env.TEST_E2E_POSTGRES_URI })

  const beforeAdapterImport = await pgPool.query(`SELECT NOW() as ts`)

  require('@prisma/adapter-pg')

  const afterAdapterImport = await pgPool.query(`SELECT NOW() as ts`)

  expect(typeof beforeAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof afterAdapterImport.rows[0].ts).toEqual('object')
  expect(beforeAdapterImport.rows[0].ts).toEqual(afterAdapterImport.rows[0].ts)

  await pgPool.end()
})
