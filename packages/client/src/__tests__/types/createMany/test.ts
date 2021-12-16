import { PrismaClient, user } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()
  const users = [
    { email: '1', age: 1 },
    { email: '2', age: 1 },
    { email: '3', age: 1 },
    { email: '4', age: 1 },
  ]
  const result: { count: number } = await prisma.user.createMany({
    data: users,
  })
}

main().catch((e) => {
  console.error(e)
})
