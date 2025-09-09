import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    describe('Batch transactions should behave correctly', () => {
      test('runs a batch that requires serial execution', async () => {
        const email = faker.internet.email()

        await expect(
          prisma.$transaction([prisma.user.create({ data: { email } }), prisma.user.findUnique({ where: { email } })]),
        ).resolves.toMatchObject([
          { email, id: expect.any(String) },
          { email, id: expect.any(String) },
        ])
      })

      test('reverts a batch that fails half-way through', async () => {
        const email1 = faker.internet.email()
        const email2 = email1 // fkey violating email
        const email3 = faker.internet.email()

        await expect(
          prisma.$transaction([
            prisma.user.create({ data: { email: email1 } }),
            prisma.user.create({ data: { email: email2 } }), // This will fail
            prisma.user.create({ data: { email: email3 } }),
          ]),
        ).rejects.toThrow('Unique constraint failed')

        await expect(prisma.user.findMany({ where: { email: { in: [email1, email2, email3] } } })).resolves.toEqual([])
      })

      test('commits a successful batch', async () => {
        const email1 = faker.internet.email()
        const email2 = faker.internet.email()
        const email3 = faker.internet.email()

        await expect(
          prisma.$transaction([
            prisma.user.create({ data: { email: email1 } }),
            prisma.user.create({ data: { email: email2 } }),
            prisma.user.create({ data: { email: email3 } }),
          ]),
        ).resolves.toMatchObject([
          { email: email1, id: expect.any(String) },
          { email: email2, id: expect.any(String) },
          { email: email3, id: expect.any(String) },
        ])

        await expect(
          prisma.user.findMany({
            where: { email: { in: [email1, email2, email3] } },
          }),
        ).resolves.toHaveLength(3)
      })
    })
  },
  {
    skipDriverAdapter: {
      from: ['js_d1'],
      reason: 'D1 does not support transactions',
    },
  },
)
