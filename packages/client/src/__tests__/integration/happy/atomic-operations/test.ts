import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import { getTestClient } from '../../../../utils/getTestClient'

const copyFile = promisify(fs.copyFile)

test('atomic-operations', async () => {
  // start with a fresh db
  await copyFile(path.join(__dirname, 'dev.db'), path.join(__dirname, 'dev-tmp.db'))

  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  const set = await prisma.user.update({
    where: {
      email: 'b@b.de',
    },
    data: {
      countInt: 1,
      countFloat: 0.0,
    },
  })

  expect(set).toEqual({
    id: '576eddf9-1111-421f-9a86-58bede16fd11',
    email: 'b@b.de',
    name: 'Alex',
    countInt: 1,
    countFloat: 0.0,
  })

  const increment = await prisma.user.update({
    where: {
      email: 'b@b.de',
    },
    data: {
      countInt: {
        increment: 1,
      },
      countFloat: {
        increment: 1.54321,
      },
    },
  })

  expect(increment).toEqual({
    id: '576eddf9-1111-421f-9a86-58bede16fd11',
    email: 'b@b.de',
    name: 'Alex',
    countInt: 2,
    countFloat: 1.54321,
  })

  const decrement = await prisma.user.update({
    where: {
      email: 'b@b.de',
    },
    data: {
      countInt: {
        decrement: 1,
      },
      countFloat: {
        decrement: 1.54321,
      },
    },
  })

  expect(decrement).toEqual({
    id: '576eddf9-1111-421f-9a86-58bede16fd11',
    email: 'b@b.de',
    name: 'Alex',
    countInt: 1,
    countFloat: 0.0,
  })

  await prisma.$disconnect()
})
