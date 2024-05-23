import { env } from 'cloudflare:test'

import { getPrisma } from './prismaClient'

describe('prismaClient', () => {
  const prisma = getPrisma(env.DB)

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('can run basic query', async () => {
    const result = await prisma.$queryRawUnsafe('select 1 + 1')

    expect(result).toEqual(2)
  })
})
