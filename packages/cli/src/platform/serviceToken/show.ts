import { arg, Command, isError } from '@prisma/internals'

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
          createdAt: string
          name: string
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
          query ($input: { environmentId: ID! }) {
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
    console.table(serviceTokens, ['id', 'displayName', 'createdAt'])
    return ''
  }
}
