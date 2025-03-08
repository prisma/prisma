import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Delete implements Command {
  public static new() {
    return new Delete()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      ...platformParameters.environment,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const { environmentDelete } = await requestOrThrow<
      {
        environmentDelete: {
          __typename: string
          id: string
          createdAt: string
          displayName: string
        }
      },
      {
        id: string
      }
    >({
      token,
      body: {
        query: /* graphql */ `
          mutation ($input: MutationEnvironmentDeleteInput!) {
            environmentDelete(input: $input) {
              __typename
              ...on Error {
                message
              }
              ...on Environment {
                id
                createdAt
                displayName
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
    return messages.resourceDeleted(environmentDelete)
  }
}
