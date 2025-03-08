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
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const projectId = getRequiredParameterOrThrow(args, ['--project', '-p'])
    const { projectDelete } = await requestOrThrow<
      {
        projectDelete: {
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
          mutation ($input: MutationProjectDeleteInput!) {
            projectDelete(input: $input) {
              __typename
              ...on Error {
                message
              }
              ...on ProjectNode {
                id
                createdAt
                displayName
              }
            }
          }
        `,
        variables: {
          input: {
            id: projectId,
          },
        },
      },
    })
    return messages.resourceDeleted(projectDelete)
  }
}
