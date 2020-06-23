import { PrismaClient, UserCreateOneWithoutPostsInput } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  type Check = 'createOrConnect' extends keyof UserCreateOneWithoutPostsInput
    ? number
    : string

  const str: Check = 'needs to be a string'
}

main().catch((e) => {
  console.error(e)
})
