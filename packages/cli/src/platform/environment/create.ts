import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'

import { argOrThrow, getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Create implements Command {
  public static new() {
    return new Create()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = argOrThrow(argv, {
      ...platformParameters.project,
      '--name': String,
      '-n': '--name',
    })
    const token = await getTokenOrThrow(args)
    const projectId = getRequiredParameterOrThrow(args, ['--project', '-p'])
    const displayName = getOptionalParameter(args, ['--name', '-n'])
    const { environmentCreate } = await requestOrThrow<
      {
        environmentCreate: {
          __typename: string
          id: string
          createdAt: string
          displayName: string
        }
      },
      {
        projectId: string
        displayName?: string
      }
    >({
      token,
      body: {
        query: /* graphql */ `
          mutation ($input: MutationEnvironmentCreateInput!) {
            environmentCreate(input: $input) {
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
            projectId,
            displayName,
          },
        },
      },
    })

    return messages.resourceCreated(environmentCreate)
  }
}
