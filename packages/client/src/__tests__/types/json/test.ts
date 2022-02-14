import { PrismaClient, Prisma } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const x = await prisma.user.findMany()
  const info: Prisma.JsonValue = x[0].info

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

  {
    const info: {
      readonly a: string[]
      readonly b: ReadonlyArray<string>
      c: string[]
      d: ReadonlyArray<string>
      e: {
        readonly a: {
          b: {}
        }
      }
    } = {
      a: [],
      b: [],
      c: [],
      d: [],
      e: { a: { b: {} } },
    }

    const result = await prisma.user.create({
      data: {
        email: 'user@example.org',
        info,
      },
    })

    await prisma.user.update({
      where: { id: '0' },
      data: { info },
    })

    await prisma.user.update({
      where: { id: '1' },
      data: {
        info: result.info === null ? Prisma.JsonNull : result.info,
      },
    })
  }

  {
    const array: ReadonlyArray<string> = []

    await prisma.user.update({
      where: { id: '0' },
      data: { info: array },
    })
  }

  {
    const array: string[] = []

    await prisma.user.update({
      where: { id: '0' },
      data: { info: array },
    })
  }
}

main().catch((e) => {
  console.error(e)
})
