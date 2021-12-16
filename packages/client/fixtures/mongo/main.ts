import { PrismaClient } from './@prisma/client'

const client = new PrismaClient()

async function main() {
  console.time('connect')
  await client.$connect()
  console.timeEnd('connect')
  console.time('create')
  const user = await client.user.create({
    data: {
      email: 'max@gmail.com',
    },
  })
  // const user = await client.user.findMany()
  console.log(user)
  console.timeEnd('create')
}

main()
  .catch(console.error)
  .finally(() => client.$disconnect())
