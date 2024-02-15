import { Command } from '@prisma/internals'

import { messages } from '../_lib/messages'
import { argOrThrow, getRequiredParameterOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.serviceToken,
    })
    const token = await getTokenOrThrow(args)
    const serviceTokenId = getRequiredParameterOrThrow(args, ['--serviceToken', '-s'])
    const { serviceTokenDelete } = await requestOrThrow<
      {
        serviceTokenDelete: {
          __typename: string
          id: string
          displayName: string
        }
      },
      { id: string }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: MutationServiceTokenDeleteInput!) {
            serviceTokenDelete(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on ServiceToken {
                id
                displayName
              }
            }
          }
        `,
        variables: {
          input: {
            id: serviceTokenId,
          },
        },
      },
    })
    return messages.resourceDeleted(serviceTokenDelete)
  }
}
