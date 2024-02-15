import { Command } from '@prisma/internals'

import { argOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.global,
    })
    const token = await getTokenOrThrow(args)
    const { me } = await requestOrThrow<{
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
                displayName
                createdAt
              }
            }
          }
        `,
      },
    })
    console.table(me.workspaces, ['id', 'displayName', 'createdAt'])
    return ''
  }
}
