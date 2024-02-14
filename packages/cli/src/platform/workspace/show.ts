import { Command } from '@prisma/internals'

import { argOrThrow } from '../lib/parameters'
import { requestOrThrow } from '../lib/pdp'
import { getTokenOrThrow, platformParameters } from '../lib/utils'

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
