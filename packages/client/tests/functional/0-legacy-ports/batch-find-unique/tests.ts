import { assertNever } from '@prisma/internals'
import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import { waitFor } from '../../_utils/tests/waitFor'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(({ provider }, _suiteMeta, _clientMeta, cliMeta) => {
  beforeAll(async () => {
    prisma = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    await prisma.user.create({
      data: {
        id: copycat.uuid(0).replaceAll('-', '').slice(-24),
        email: copycat.email(1),
        age: 20,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(1).replaceAll('-', '').slice(-24),
        email: copycat.email(2),
        age: 45,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(2).replaceAll('-', '').slice(-24),
        email: copycat.email(3),
        age: 60,
      },
    })
    await prisma.user.create({
      data: {
        id: copycat.uuid(3).replaceAll('-', '').slice(-24),
        email: copycat.email(4),
        age: 63,
      },
    })

    await new Promise((r) => setTimeout(r, 1_000))
  })

  test('findUnique batching', async () => {
    // regex for 0wCIl-826241-1694134591596
    const mySqlSchemaIdRegex = /\w+-\d+-\d+/g
    let executedBatchQuery: string | undefined

    expect.assertions(2)

    prisma.$on('query', (event) => {
      executedBatchQuery = event.query
        .replace(` /* traceparent='00-00000000000000000000000000000010-0000000000000010-01' */`, '')
        .replace(mySqlSchemaIdRegex, '')
        .trim()
    })

    const results = await Promise.all([
      prisma.user.findUnique({ where: { email: copycat.email(1) } }),
      prisma.user.findUnique({ where: { email: copycat.email(2) } }),
      prisma.user.findUnique({ where: { email: copycat.email(3) } }),
      prisma.user.findUnique({ where: { email: copycat.email(4) } }),
    ])

    await waitFor(() => {
      if (executedBatchQuery === undefined) {
        throw new Error('executedBatchQuery is undefined')
      }
    })

    switch (provider) {
      case Providers.POSTGRESQL:
      case Providers.COCKROACHDB:
        if (cliMeta.previewFeatures.includes('relationJoins')) {
          expect(executedBatchQuery).toMatchInlineSnapshot(
            `"SELECT "t1"."id", "t1"."email", "t1"."age", "t1"."name" FROM "public"."User" AS "t1" WHERE "t1"."email" IN ($1,$2,$3,$4)"`,
          )
        } else {
          expect(executedBatchQuery).toMatchInlineSnapshot(
            `"SELECT "public"."User"."id", "public"."User"."email", "public"."User"."age", "public"."User"."name" FROM "public"."User" WHERE "public"."User"."email" IN ($1,$2,$3,$4) OFFSET $5"`,
          )
        }
        break

      case Providers.MYSQL:
        if (cliMeta.previewFeatures.includes('relationJoins')) {
          expect(executedBatchQuery).toMatchInlineSnapshot(
            `"SELECT \`t1\`.\`id\`, \`t1\`.\`email\`, \`t1\`.\`age\`, \`t1\`.\`name\` FROM \`\`.\`User\` AS \`t1\` WHERE \`t1\`.\`email\` IN (?,?,?,?)"`,
          )
        } else {
          expect(executedBatchQuery).toMatchInlineSnapshot(
            `"SELECT \`\`.\`User\`.\`id\`, \`\`.\`User\`.\`email\`, \`\`.\`User\`.\`age\`, \`\`.\`User\`.\`name\` FROM \`\`.\`User\` WHERE \`\`.\`User\`.\`email\` IN (?,?,?,?)"`,
          )
        }
        break

      case Providers.SQLITE:
        expect(executedBatchQuery).toMatchInlineSnapshot(
          `"SELECT \`main\`.\`User\`.\`id\`, \`main\`.\`User\`.\`email\`, \`main\`.\`User\`.\`age\`, \`main\`.\`User\`.\`name\` FROM \`main\`.\`User\` WHERE \`main\`.\`User\`.\`email\` IN (?,?,?,?) LIMIT ? OFFSET ?"`,
        )
        break

      case Providers.SQLSERVER:
        expect(executedBatchQuery).toMatchInlineSnapshot(
          `"SELECT [dbo].[User].[id], [dbo].[User].[email], [dbo].[User].[age], [dbo].[User].[name] FROM [dbo].[User] WHERE [dbo].[User].[email] IN (@P1,@P2,@P3,@P4)"`,
        )
        break

      case Providers.MONGODB:
        expect(executedBatchQuery).toMatchInlineSnapshot(
          `"db.User.aggregate([ { $match: { $expr: { $and: [ { $or: [ { $eq: [ "$email", { $literal: "Pete.Runte93767@broaden-dungeon.info", }, ], }, { $eq: [ "$email", { $literal: "Sam.Mills50272@oozeastronomy.net", }, ], }, { $eq: [ "$email", { $literal: "Kyla_Beer587@fraternise-assassination.name", }, ], }, { $eq: [ "$email", { $literal: "Arielle.Reichel85426@hunker-string.org", }, ], }, ], }, { $ne: [ "$email", "$$REMOVE", ], }, ], }, }, }, { $project: { _id: 1, email: 1, age: 1, name: 1, }, }, ])"`,
        )
        break

      default:
        assertNever(provider, 'queries for all providers must be snapshotted')
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "age": 20,
          "email": "Pete.Runte93767@broaden-dungeon.info",
          "id": "341952ef935455f20a169c25",
          "name": null,
        },
        {
          "age": 45,
          "email": "Sam.Mills50272@oozeastronomy.net",
          "id": "02d25579a73a72373fa4e846",
          "name": null,
        },
        {
          "age": 60,
          "email": "Kyla_Beer587@fraternise-assassination.name",
          "id": "a85d5d75a3a886cb61eb3a0e",
          "name": null,
        },
        {
          "age": 63,
          "email": "Arielle.Reichel85426@hunker-string.org",
          "id": "a7fe5dac91ab6b0f529430c5",
          "name": null,
        },
      ]
    `)
  })
})
