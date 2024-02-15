import { arg, Command, isError } from '@prisma/internals'

import { messages } from '../_lib/messages'
import { getRequiredParameterOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.environment,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const { serviceTokens } = await requestOrThrow<
      {
        serviceTokens: {
          __typename: string
          createdAt: string
          displayName: string
          id: string
        }[]
      },
      {
        environmentId: string
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          query ($input: QueryServiceTokensInput!) {
            serviceTokens(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on ServiceToken {
                id
                createdAt
                displayName
              }
            }
          }
        `,
        variables: {
          input: {
            environmentId,
          },
        },
      },
    })
    return messages.resourceList(serviceTokens)
  }
}
