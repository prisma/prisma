import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { green } from 'kleur/colors'

import { argOrThrow, getOptionalParameter } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new() {
    return new Show()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = argOrThrow(argv, {
      ...platformParameters.global,
      '--sensitive': Boolean,
    })
    const token = await getTokenOrThrow(args)
    const { me } = await requestOrThrow<{
      me: {
        user: {
          __typename: string
          id: string
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
                __typename
                id
                email
                displayName
              }
            }
          }
        `,
      },
    })

    const data = {
      ...me.user,
      token: getOptionalParameter(args, ['--sensitive']) ? token : null,
    }

    return messages.sections([
      messages.info(`Currently authenticated as ${green(me.user.email)}`),
      messages.resource(data, {
        email: true,
        token: true,
      }),
    ])
  }
}
