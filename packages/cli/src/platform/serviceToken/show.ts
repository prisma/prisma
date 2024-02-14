import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow } from '../lib/parameters'
import { requestOrThrow } from '../lib/pdp'
import { getTokenOrThrow, platformParameters } from '../lib/utils'

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
                name: displayName
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
    console.table(serviceTokens, ['id', 'name', 'createdAt'])
    return ''
  }
}
