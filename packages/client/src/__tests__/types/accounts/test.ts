import { AccountData, PrismaClient, RandomModel } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const globalConfig: {
    accounts: {
      id: string
    }[]
  } | null = await prisma.globalConfiguration.findUnique({
    where: {
      id: '',
    },
    select: {
      accounts: {
        select: {
          id: true,
        },
      },
    },
  })

  const userTest: {
    id: string
    globalConfiguration: {
      accounts: {
        config: {
          list: RandomModel[]
          data: AccountData | null
        }
      }[]
    }
  } | null = await prisma.userTest.findUnique({
    where: {
      id: 'Example',
    },
    select: {
      id: true,
      globalConfiguration: {
        select: {
          accounts: {
            select: {
              config: {
                select: {
                  list: true,
                  data: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const x = await prisma.userTest.findMany({
    where: {
      role: {
        equals: 'ADMIN',
      },
    },
  })
}

main().catch((e) => {
  console.error(e)
})
