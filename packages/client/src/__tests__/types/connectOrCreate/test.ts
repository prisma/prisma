import type { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  type Check = 'connectOrCreate' extends keyof Prisma.UserCreateNestedOneWithoutPostsInput ? number : string

  const str: Check = 12345
}

main().catch((e) => {
  console.error(e)
})
