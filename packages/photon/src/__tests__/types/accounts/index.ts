import { Photon, RandomModel, AccountData } from '@prisma/photon'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const photon = new Photon()

  const globalConfig: {
    accounts: {
      id: string
    }[]
  } | null = await photon.globalConfigurations.findOne({
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
  } | null = await photon.userTests.findOne({
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
}

main().catch(e => {
  console.error(e)
})
