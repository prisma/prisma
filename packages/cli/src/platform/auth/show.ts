import { Command, formatTable } from '@prisma/internals'
import { green } from 'kleur/colors'

import { argOrThrow } from '../lib/parameters'
import { requestOrThrow } from '../lib/pdp'
import { getTokenOrThrow, platformParameters } from '../lib/utils'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, { ...platformParameters.global })
    const token = await getTokenOrThrow(args)
    const { me } = await requestOrThrow<{
      me: {
        user: {
          id: string
          handle: string
          email: string
          displayName: string
        }
      }
    }>({
      token,
      body: {
        query: /* graphql */ `
          query {
            me {
              __typename
              user {
                id
                email
                displayName
              }
            }
          }
        `,
      },
    })
    console.info(`Currently authenticated as ${green(me.user.email)}\n`)
    return formatTable([
      ['id', me.user.id],
      ['email', me.user.email],
      ['displayName', me.user.displayName],
    ])
  }
}
