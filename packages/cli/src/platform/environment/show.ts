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
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const projectId = getRequiredParameterOrThrow(args, ['--project', '-p'])
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
            project(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on Project {
                environments {
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
            id: projectId,
          },
        },
      },
    })

    console.table(workspace.projects, ['id', 'name', 'createdAt'])
    return ''
  }
}
