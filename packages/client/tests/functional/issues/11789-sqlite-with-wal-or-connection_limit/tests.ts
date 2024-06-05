import { faker } from '@faker-js/faker'

import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

// From npx prisma migrate diff --from-empty --to-schema-datamodel=...
const sqlDef = `CREATE TABLE "User" (
   "id" TEXT NOT NULL PRIMARY KEY,
   "email" TEXT NOT NULL
);
CREATE TABLE "Profile" (
   "id" TEXT NOT NULL PRIMARY KEY,
   "userId" TEXT NOT NULL,
   CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId")`

/**
 * tests for #11789
 */
testMatrix.setupTestSuite(
  ({ driverAdapter }) => {
    testIf(driverAdapter === 'js_d1')('D1 does not support journal_mode = WAL', async () => {
      const prisma = newPrismaClient()
      expect.assertions(1)

      try {
        await prisma.$queryRaw`PRAGMA journal_mode = WAL`
      } catch (error) {
        const e = error as Error
        expect(e.message).toContain('D1_ERROR: not authorized')
      }
    })

    testIf(driverAdapter !== 'js_d1')('2 concurrent upsert should succeed with journal_mode = WAL', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {
            url: 'file:./concurrent-upsert-wal.db',
          },
        },
      })

      await expect(prisma.$queryRaw`PRAGMA journal_mode = WAL`).resolves.toEqual([{ journal_mode: 'wal' }])

      const ddlQueries: any = []
      sqlDef.split(';').forEach((sql) => {
        ddlQueries.push(prisma.$executeRawUnsafe(sql))
      })
      await prisma.$transaction(ddlQueries)

      const id1 = faker.database.mongodbObjectId()
      const id2 = faker.database.mongodbObjectId()

      // User 1
      await prisma.user.create({
        data: {
          id: id1,
          email: `${id1}@example.ext`,
        },
      })
      // User 2
      await prisma.user.create({
        data: {
          id: id2,
          email: `${id2}@example.ext`,
        },
      })

      //
      // Note: it works as a transaction
      // const queries = await prisma.$transaction([
      //
      const queries = Promise.all([
        // Profile 1
        prisma.profile.upsert({
          update: {},
          where: {
            id: id1,
          },
          create: {
            user: {
              connect: {
                id: id1,
              },
            },
          },
        }),
        // Profile 2
        prisma.profile.upsert({
          update: {},
          where: {
            id: id2,
          },
          create: {
            user: {
              connect: {
                id: id2,
              },
            },
          },
        }),
      ])

      await expect(queries).resolves.toHaveLength(2)
    })

    testIf(driverAdapter !== 'js_d1')(
      '2 concurrent upsert should succeed with connection_limit=1 & journal_mode = WAL',
      async () => {
        const prisma = newPrismaClient({
          datasources: {
            db: {
              url: 'file:./concurrent-upsert-conn-wal.db?connection_limit=1',
            },
          },
        })

        await expect(prisma.$queryRaw`PRAGMA journal_mode = WAL`).resolves.toEqual([{ journal_mode: 'wal' }])

        const ddlQueries: any = []
        sqlDef.split(';').forEach((sql) => {
          ddlQueries.push(prisma.$executeRawUnsafe(sql))
        })
        await prisma.$transaction(ddlQueries)

        const id1 = faker.database.mongodbObjectId()
        const id2 = faker.database.mongodbObjectId()

        // User 1
        await prisma.user.create({
          data: {
            id: id1,
            email: `${id1}@example.ext`,
          },
        })
        // User 2
        await prisma.user.create({
          data: {
            id: id2,
            email: `${id2}@example.ext`,
          },
        })

        //
        // Note: it works as a transaction
        // const queries = await prisma.$transaction([
        //
        const queries = Promise.all([
          // Profile 1
          prisma.profile.upsert({
            update: {},
            where: {
              id: id1,
            },
            create: {
              user: {
                connect: {
                  id: id1,
                },
              },
            },
          }),
          // Profile 2
          prisma.profile.upsert({
            update: {},
            where: {
              id: id2,
            },
            create: {
              user: {
                connect: {
                  id: id2,
                },
              },
            },
          }),
        ])

        await expect(queries).resolves.toHaveLength(2)
      },
    )

    test('2 concurrent upsert should succeed with connection_limit=1', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {
            url: 'file:./concurrent-upsert.db?connection_limit=1',
          },
        },
      })

      const ddlQueries: any = []
      sqlDef.split(';').forEach((sql) => {
        ddlQueries.push(prisma.$executeRawUnsafe(sql))
      })
      await prisma.$transaction(ddlQueries)

      const id1 = faker.database.mongodbObjectId()
      const id2 = faker.database.mongodbObjectId()

      // User 1
      await prisma.user.create({
        data: {
          id: id1,
          email: `${id1}@example.ext`,
        },
      })
      // User 2
      await prisma.user.create({
        data: {
          id: id2,
          email: `${id2}@example.ext`,
        },
      })

      //
      // Note: it works as a transaction
      // const queries = await prisma.$transaction([
      //
      const queries = Promise.all([
        // Profile 1
        prisma.profile.upsert({
          update: {},
          where: {
            id: id1,
          },
          create: {
            user: {
              connect: {
                id: id1,
              },
            },
          },
        }),
        // Profile 2
        prisma.profile.upsert({
          update: {},
          where: {
            id: id2,
          },
          create: {
            user: {
              connect: {
                id: id2,
              },
            },
          },
        }),
      ])

      await expect(queries).resolves.toHaveLength(2)
    })

    testIf(driverAdapter !== 'js_d1')('2 concurrent delete should succeed with connection_limit=1', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {
            url: 'file:./concurrent-delete.db?connection_limit=1',
          },
        },
      })

      const ddlQueries: any = []
      sqlDef.split(';').forEach((sql) => {
        ddlQueries.push(prisma.$executeRawUnsafe(sql))
      })
      await prisma.$transaction(ddlQueries)

      const id1 = faker.database.mongodbObjectId()
      const id2 = faker.database.mongodbObjectId()

      // User 1
      await prisma.user.create({
        data: {
          id: id1,
          email: `${id1}@example.ext`,
        },
      })
      // User 2
      await prisma.user.create({
        data: {
          id: id2,
          email: `${id2}@example.ext`,
        },
      })

      const queries = Promise.all([
        // User 1
        prisma.user.delete({
          where: {
            id: id1,
          },
        }),
        // User 2
        prisma.user.delete({
          where: {
            id: id2,
          },
        }),
      ])

      await expect(queries).resolves.toHaveLength(2)
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    optOut: {
      from: ['sqlserver', 'mongodb', 'postgresql', 'cockroachdb', 'mysql'],
      reason: 'Test is made for SQLite only',
    },
  },
)
