import { Command } from '@prisma/internals'
import { green } from 'kleur/colors'

import { messages } from '../_lib/messages'
import { argOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

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
    return messages.sections([
      messages.info(`Currently authenticated as ${green(me.user.email)}`),
      messages.table(me.user, ['id', 'email', 'displayName']),
    ])
  }
}
