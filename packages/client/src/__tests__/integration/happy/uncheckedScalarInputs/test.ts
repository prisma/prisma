import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import { getTestClient } from '../../../../utils/getTestClient'

const copyFile = promisify(fs.copyFile)

test('uncheckedScalarInputs', async () => {
  await copyFile(path.join(__dirname, 'dev.db'), path.join(__dirname, 'dev-tmp.db'))
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  await prisma.user.deleteMany()
  await prisma.post.deleteMany()
  const user = await prisma.user.create({
    data: {
      email: 'bob@bob.de',
      name: 'Alice',
    },
  })

  const post = await prisma.post.create({
    data: {
      published: false,
      title: 'Mitle',
      content: 'Blub',
      authorId: user.id,
    },
    include: {
      author: true,
    },
  })

  expect(post.authorId).toEqual(user.id)
  expect(post.authorId).toEqual(post.author.id)
  await prisma.user.deleteMany()
  await prisma.post.deleteMany()

  await prisma.$disconnect()
})
