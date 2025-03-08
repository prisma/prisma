import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new() {
    return new Show()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      ...platformParameters.workspace,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const workspaceId = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const { workspace } = await requestOrThrow<
      {
        workspace: {
          projects: {
            __typename: string
            id: string
            createdAt: string
            displayName: string
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
          query ($input: QueryWorkspaceInput!) {
            workspace(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on Workspace {
                projects {
                  __typename
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
            id: workspaceId,
          },
        },
      },
    })

    return messages.resourceList(workspace.projects)
  }
}
