import { Pool } from 'pg'

test('node-postgres global type parsers should not be changed by `@prisma/adapter-pg`', async () => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL })

  const beforeAdapterImport = await pgPool.query('SELECT NOW() as ts')

  require('@prisma/adapter-pg')

  const afterAdapterImport = await pgPool.query('SELECT NOW() as ts')

  expect(typeof beforeAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof afterAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof beforeAdapterImport.rows[0].ts).toEqual(typeof afterAdapterImport.rows[0].ts)

  await pgPool.end()
})

test('node-postgres global type parsers should not be changed by `@prisma/adapter-pg-worker`', async () => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL })

  const beforeAdapterImport = await pgPool.query('SELECT NOW() as ts')

  require('@prisma/adapter-pg-worker')

  const afterAdapterImport = await pgPool.query('SELECT NOW() as ts')

  expect(typeof beforeAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof afterAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof beforeAdapterImport.rows[0].ts).toEqual(typeof afterAdapterImport.rows[0].ts)

  await pgPool.end()
})

test('node-postgres global type parsers should not be changed by `@prisma/adapter-neon`', async () => {
  const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL })

  const beforeAdapterImport = await pgPool.query('SELECT NOW() as ts')

  require('@prisma/adapter-neon')

  const afterAdapterImport = await pgPool.query('SELECT NOW() as ts')

  expect(typeof beforeAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof afterAdapterImport.rows[0].ts).toEqual('object')
  expect(typeof beforeAdapterImport.rows[0].ts).toEqual(typeof afterAdapterImport.rows[0].ts)

  await pgPool.end()
})
