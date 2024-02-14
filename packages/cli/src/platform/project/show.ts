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
      ...platformParameters.workspace,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const workspaceId = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const { workspace } = await requestOrThrow<
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
        id: string
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          query ($input: { $id: ID! }) {
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
            id: workspaceId,
          },
        },
      },
    })

    console.table(workspace.projects, ['id', 'name', 'createdAt'])
    return ''
  }
}
