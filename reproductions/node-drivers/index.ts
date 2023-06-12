import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient()
  console.log('[nodejs] initialized PrismaClient')

  const manyUsers = await prisma.some_user.findMany()
  console.log('[nodejs] manyUsers', manyUsers)

  // Note: findFirst() would fail because Node Drivers doesn't yet support prepared "?" parameters.
  // See: https://github.com/prisma/team-orm/issues/58
  //
  // const firstUser = await prisma.some_user.findFirst()
  // console.log('[nodejs] firstUser', firstUser)

  // Note: deleteMany() would fail because Node Drivers doesn't yet support raw_cmd().
  // await prisma.some_user.deleteMany()
  // const usersAfterDeleteMany = await prisma.some_user.findMany()
  // console.log('[nodejs] usersAfterDeleteMany', usersAfterDeleteMany)

  console.log('[nodejs] disconnecting PrismaClient')
  await prisma.$disconnect()
  console.log('[nodejs] disconnected PrismaClient')

  // Note: Node Drivers currently hangs, as `prisma.$disconnect()` doesn't yet close the underlying connection.
  console.log('[nodejs] exiting...')
  process.exit(0)
}

main()
