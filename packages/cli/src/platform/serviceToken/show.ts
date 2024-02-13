import { arg, Command, isError } from '@prisma/internals'

import {
  getPlatformTokenOrThrow,
  getRequiredParameterOrThrow,
  platformParameters,
  platformRequestOrThrow,
} from '../platformUtils'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.environment,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const { serviceTokens } = await platformRequestOrThrow<
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
