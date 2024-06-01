import { PrismaClient } from './generated-client'
// import { PrismaLibSQL } from '@prisma/adapter-libsql'
// import { createClient } from '@libsql/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

async function main() {

  // const prisma = new PrismaClient()

  // const libsql = createClient({
  //   url: 'file:prisma/dev.db',
  // })
  // const adapter = new PrismaLibSQL(libsql)
  
  const pool = new Pool({ connectionString: "postgres://prisma:prisma@localhost:5432/tests" })
  const adapter = new PrismaPg(pool)

  const prisma = new PrismaClient({ adapter, log: ['query'] })

  console.log("deleteMany")
  await prisma.user.deleteMany()

  console.log("create")
  const email = `user.${Date.now()}@prisma.io`
  await prisma.user.create({
    data: {
      email: email,
    },
  })
  const email2 = `user.${Date.now()}2@prisma.io`
  await prisma.user.create({
    data: {
      email: email2,
    },
  })

  console.log("findMany, no filter")
  const users = await prisma.user.findMany()
  console.log({ users })

  // console.log("findMany, filter")
  // const usersFiltered = await prisma.user.findMany({ where: { email: {  contains: "1" }}})
  // console.log({ usersFiltered })

  console.log("findMany Link, no filter")
  const links = await prisma.link.findMany()
  console.log({ links })

  console.log("findMany, no filter, count links")
  const usersWithLinkCount = await prisma.user.findMany({ include: { _count: { select: { links: true }} }})
  console.dir({ usersWithLinkCount }, { depth: null })
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
