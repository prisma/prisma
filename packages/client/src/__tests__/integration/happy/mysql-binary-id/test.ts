import path from 'node:path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_MYSQL_URI!.replace('tests', 'tests-mysql-binary-id')
  await tearDownMysql(process.env.DATABASE_URL)
  await migrateDb({
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('find by binary id', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  const binaryString = (str: string) => new Uint8Array(Buffer.from(str))

  await prisma.entry.deleteMany()

  const a = await prisma.entry.create({
    data: {
      id: binaryString('aaaa'),
      name: 'a',
    },
  })

  const b = await prisma.entry.create({
    data: {
      id: binaryString('bbbb'),
      name: 'b',
    },
  })

  const c = await prisma.entry.create({
    data: {
      id: binaryString('cccc'),
      name: 'c',
    },
  })

  expect(
    await prisma.entry.findFirst({
      where: {
        id: binaryString('aaaa'),
      },
    }),
  ).toEqual(a)

  expect(
    await prisma.entry.findMany({
      where: {
        id: {
          in: [binaryString('bbbb'), binaryString('cccc')],
        },
      },
    }),
  ).toEqual([b, c])

  await prisma.$disconnect()
})
