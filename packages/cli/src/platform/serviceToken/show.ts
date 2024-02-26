import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new(legacy: boolean = false) {
    return new Show(legacy)
  }
  constructor(private readonly legacy: boolean = false) {}

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.environment,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const { environment } = await requestOrThrow<
      {
        environment: {
          serviceTokens: {
            __typename: string
            createdAt: string
            displayName: string
            id: string
          }[]
        }
      },
      {
        id: string
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          query ($input: QueryEnvironmentInput!) {
            environment(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on Environment {
                serviceTokens {
                  id
                  createdAt
                  displayName
                }
              }
            }
          }
        `,
        variables: {
          input: {
            id: environmentId,
          },
        },
      },
    })
    const resources = this.legacy
      ? environment.serviceTokens.map((serviceToken) => ({ ...serviceToken, __typename: 'APIKey' }))
      : environment.serviceTokens
    return messages.resourceList(resources)
  }
}
