import { arg, Command, isError } from '@prisma/internals'

import {
  getPlatformTokenOrThrow,
  getRequiredParameterOrThrow,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../platformUtils'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)
    const projectId = getRequiredParameterOrThrow(args, ['--project', '-p'])

    const { projectDelete } = await platformRequestOrThrow<
      {
        projectDelete: {
          __typename: 'Project'
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
          mutation ProjectDelete($input: { $id: ID! }) {
            projectDelete(input: $input) {
              __typename
              ...on Error {
                message
              }
              ...on Project {
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

    return successMessage(`Project ${projectDelete.displayName} - ${projectDelete.id} deleted.`)
  }
}
