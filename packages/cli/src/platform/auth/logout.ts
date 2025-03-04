import { type Command, getCommandWithExecutor, isError } from '@prisma/internals'
import { green } from 'kleur/colors'

import { credentialsFile } from '../_lib/credentials'
import { decodeJwt } from '../_lib/jwt'
import { successMessage } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'

export class Logout implements Command {
  public static new() {
    return new Logout()
  }

  public async parse() {
    const credentials = await credentialsFile.load()
    if (isError(credentials)) throw credentials
    if (!credentials)
      return `You are not currently logged in. Run ${green(getCommandWithExecutor('prisma platform auth login --early-access'))} to log in.` // prettier-ignore

    if (credentials.token) {
      const jwt = decodeJwt(credentials.token)
      if (!isError(jwt) && jwt.jti) {
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
                id: jwt.jti,
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
