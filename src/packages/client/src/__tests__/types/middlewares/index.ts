import { PrismaClient } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  prisma.use(async (params, next) => {
    return next(params)
  })
}

main().catch((e) => {
  console.error(e)
})
