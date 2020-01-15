import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient({})

  // prisma.on('query', q => {
  //   console.log('query', q)
  // })

  // prisma.on('info', q => {
  //   console.log('info', q)
  // })

  const users = await prisma.users()

  console.log(users)
}

main().catch(e => {
  console.error(e)
})
