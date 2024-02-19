import { Command, getCommandWithExecutor, isError } from '@prisma/internals'
import { decodeJwt } from 'jose'
import { green } from 'kleur/colors'

import { credentialsFile } from '../_lib/credentials'
import { successMessage } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'

interface JWT {
  jti: string
  sub: string
  iat: number
}

export class Logout implements Command {
  public static new() {
    return new Logout()
  }

  public async parse() {
    const credentials = await credentialsFile.load()
    if (isError(credentials)) throw credentials
    if (!credentials) return `You are not currently logged in. Run ${green(getCommandWithExecutor('prisma platform auth login --early-access'))} to log in.` // prettier-ignore

    if (credentials.token) {
      let tokenDecoded: null | JWT = null
      try {
        tokenDecoded = decodeJwt(credentials.token)
        if (!tokenDecoded || !(tokenDecoded.jti && tokenDecoded.sub && tokenDecoded.iat)) {
          throw new Error('Token invalid')
        }
      } catch {}
      if (tokenDecoded && tokenDecoded.jti) {
        await requestOrThrow<
          {
            managementTokenDelete: {
              __typename: string
            }
          },
          {
            id: string
          }
        >({
          token: credentials.token,
          body: {
            query: /* GraphQL */ `
              mutation ($input: MutationManagementTokenDeleteInput!) {
                managementTokenDelete(input: $input) {
                  __typename
                  ... on Error {
                    message
                  }
                }
              }
            `,
            variables: {
              input: {
                id: tokenDecoded.jti,
              },
            },
          },
        })
      }
    }

    await credentialsFile.delete()
    return successMessage('You have logged out.')
  }
}
