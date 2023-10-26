import { PrismaPg } from '@prisma/adapter-pg'
import { Pool as pgPool } from 'pg'

console.debug('process.env.TEST_ENV_VAR 1', process.env.TEST_ENV_VAR)

beforeEach(() => {
  delete process.env.TEST_ENV_VAR
})

test('should load .env file without adapter', () => {
  expect(process.env.TEST_ENV_VAR).toEqual(undefined)

  const { PrismaClient } = require('@prisma/client')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const prisma = new PrismaClient({
    adapter: null,
  })

  expect(process.env.TEST_ENV_VAR).toEqual('should_be_defined')
})

test('should NOT load .env file with adapter', () => {
  expect(process.env.TEST_ENV_VAR).toEqual(undefined)

  const { PrismaClient } = require('@prisma/client')

  const pool = new pgPool({
    connectionString: '',
  })

  const adapter = new PrismaPg(pool)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const prisma = new PrismaClient({
    adapter,
  })

  expect(process.env.TEST_ENV_VAR).toEqual(undefined)
})

export {}
