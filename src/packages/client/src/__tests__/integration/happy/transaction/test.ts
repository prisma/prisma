const assert = require('assert')
const crypto = require('crypto')
import { generateTestClient } from '../../../../utils/getTestClient'

function clean(array: any[]) {
  return array.map((item) => {
    if (Array.isArray(item)) {
      return clean(item)
    } else {
      if (item?.id) {
        item.id = 'REMOVED'
      }
      return item
    }
  })
}

test('transaction', async () => {
  await generateTestClient()
  const {
    PrismaClient,
    Prisma: { prismaVersion },
  } = require('./node_modules/@prisma/client')
  const db = new PrismaClient()

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  // Test connecting and disconnecting all the time
  const result = await db.$transaction([
    db.user.findMany(),
    db.user.create({
      data: {
        email: 'test@hey.com',
      },
    }),
    db.user.findMany(),
    db.user.delete({ where: { email: 'test@hey.com' } }),
  ])
  expect(clean(result)).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          email: a@a.de,
          id: REMOVED,
          name: Alice,
        },
      ],
      Object {
        email: test@hey.com,
        id: REMOVED,
        name: null,
      },
      Array [
        Object {
          email: a@a.de,
          id: REMOVED,
          name: Alice,
        },
        Object {
          email: test@hey.com,
          id: REMOVED,
          name: null,
        },
      ],
      Object {
        email: test@hey.com,
        id: REMOVED,
        name: null,
      },
    ]
  `)
  const email = crypto.randomBytes(20).toString('hex') + '@hey.com'

  // intentionally use the same email 2 times to see, if the transaction gets rolled back properly
  // TODO: Handle the error here and make sure it's the right one
  try {
    await db.$transaction([
      db.user.create({
        data: {
          email,
        },
      }),
      db.user.create({
        data: {
          email,
        },
      }),
    ])
  } catch (e) {
    if (!(e.code === 'P2002' || e.message.includes('P2002'))) {
      throw new Error(e)
    }
  }

  const users = await db.user.findMany()
  assert.equal(users.length, 1)

  db.$disconnect()
})
