import path from 'path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

beforeAll(async () => {
  process.env.TEST_MYSQL_URI += '-mysql-binary-id'
  await tearDownMysql(process.env.TEST_MYSQL_URI!)
  await migrateDb({
    connectionString: process.env.TEST_MYSQL_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('find by binary id', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.entry.deleteMany()

  const a = await prisma.entry.create({
    data: {
      id: Buffer.from('aaaa'),
      name: 'a',
    },
  })

  const b = await prisma.entry.create({
    data: {
      id: Buffer.from('bbbb'),
      name: 'b',
    },
  })

  const c = await prisma.entry.create({
    data: {
      id: Buffer.from('cccc'),
      name: 'c',
    },
  })

  expect(
    await prisma.entry.findFirst({
      where: {
        id: Buffer.from('aaaa'),
      },
    }),
  ).toEqual(a)

  expect(
    await prisma.entry.findMany({
      where: {
        id: {
          in: [Buffer.from('bbbb'), Buffer.from('cccc')],
        },
      },
    }),
  ).toEqual([b, c])

  await prisma.$disconnect()
})
