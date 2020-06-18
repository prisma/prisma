import { PrismaClient, JsonValue } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const x = await prisma.user.findMany()
  const info: JsonValue = x[0].info

  type OptionalObject = {
    value?: string | undefined
  }
  const y: OptionalObject = {
    value: undefined,
  }

  await prisma.user.create({
    data: {
      info: y,
      email: '...',
    },
  })

  await prisma.user.update({
    where: {
      id: '123',
    },
    data: {
      info: y,
    },
  })
}

main().catch((e) => {
  console.error(e)
})
