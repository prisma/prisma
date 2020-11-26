import {
  PrismaClient,
  PrismaClientKnownRequestError,
  SortOrder,
} from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  try {
    const x = await prisma.user.findMany()
  } catch (e) {
    if (!(e instanceof PrismaClientKnownRequestError)) {
      //
    }
  }

  const x: SortOrder = 'asc'
}

main().catch((e) => {
  console.error(e)
})
