import { faker } from '@faker-js/faker'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should create many records', async () => {
      const email1 = faker.internet.email()
      const email2 = faker.internet.email()
      const email3 = faker.internet.email()
      const email4 = faker.internet.email()

      const created = await prisma.user.createManyAndReturn({
        data: [
          {
            email: email1,
          },
          {
            email: email2,
          },
          {
            email: email3,
          },
          {
            email: email4,
          },
        ],
      })

      expect(created).toMatchObject([
        {
          email: email1,
          id: expect.any(String),
          name: null,
        },
        {
          email: email2,
          id: expect.any(String),
          name: null,
        },
        {
          email: email3,
          id: expect.any(String),
          name: null,
        },
        {
          email: email4,
          id: expect.any(String),
          name: null,
        },
      ])
    })
  },
  {
    skipDriverAdapter: {
      from: ['js_d1'],
      reason:
        'D1 driver adapter does not return the correct number of created records. See https://github.com/prisma/team-orm/issues/1069',
    },
    optOut: {
      from: [Providers.MONGODB, Providers.SQLSERVER, Providers.MYSQL],
      reason: 'Excluded dbs are missing the "ConnectorCapability::InsertReturning".',
    },
  },
)
