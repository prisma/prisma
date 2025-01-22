import { isPrismaPostgres, PRISMA_POSTGRES_PROTOCOL } from './prismaPostgres'

describe('isPrismaPostgres', () => {
  test('returns false on invalid or non Prisma Postgres protocols', () => {
    expect(isPrismaPostgres()).toBe(false)
    expect(isPrismaPostgres('')).toBe(false)
    expect(isPrismaPostgres('mysql://database.url/test')).toBe(false)
    expect(isPrismaPostgres('prisma://database.url/test')).toBe(false)
  })

  test('returns true on valid Prisma Postgres protocols', () => {
    expect(isPrismaPostgres('prisma+postgres://database.url/test')).toBe(true)
    expect(isPrismaPostgres(`${PRISMA_POSTGRES_PROTOCOL}//database.url/test`)).toBe(true)
  })
})
