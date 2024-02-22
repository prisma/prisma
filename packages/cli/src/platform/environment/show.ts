import { arg, Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new() {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const projectId = getRequiredParameterOrThrow(args, ['--project', '-p'])
    const { project } = await requestOrThrow<
      {
        project: {
          environments: {
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
          query ($input: QueryProjectInput!) {
            project(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on Project {
                environments {
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
            id: projectId,
          },
        },
      },
    })

    return messages.resourceList(project.environments)
  }
}
