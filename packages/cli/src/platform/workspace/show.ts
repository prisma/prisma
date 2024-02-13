import { Command } from '@prisma/internals'

import { argOrThrow, getPlatformTokenOrThrow, platformParameters, platformRequestOrThrow } from '../platformUtils'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.global,
    })
    const token = await getPlatformTokenOrThrow(args)
    const { me } = await platformRequestOrThrow<{
      me: {
        workspaces: {
          id: string
          displayName: string
          createdAt: string
        }[]
      }
    }>({
      token,
      body: {
        query: /* GraphQL */ `
          query {
            me {
              __typename
              workspaces {
                id
                name: displayName
                createdAt
              }
            }
          }
        `,
      },
    })
    console.table(me.workspaces, ['id', 'name', 'createdAt'])
    return ''
  }
}
