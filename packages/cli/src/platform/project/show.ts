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
      ...platformParameters.workspace,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)
    const workspaceId = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const { workspace } = await platformRequestOrThrow<
      {
        workspace: {
          projects: {
            id: string
            createdAt: string
            displayName: string
          }[]
        }
      },
      {
        workspaceId: string
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          query ($input: { $workspaceId: ID! }) {
            workspace(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on Workspace {
                projects {
                  id
                  createdAt
                  name: displayName
                }
              }
            }
          }
        `,
        variables: {
          input: {
            workspaceId,
          },
        },
      },
    })

    console.table(workspace.projects, ['id', 'name', 'createdAt'])

    return ''
  }
}
