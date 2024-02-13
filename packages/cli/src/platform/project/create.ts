import { Command } from '@prisma/internals'

import {
  argOrThrow,
  getOptionalParameter,
  getPlatformTokenOrThrow,
  getRequiredParameterOrThrow,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../platformUtils'

export class Create implements Command {
  public static new(): Create {
    return new Create()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.workspace,
      '--name': String,
      '-n': '--name',
    })
    const token = await getPlatformTokenOrThrow(args)
    const workspaceId = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const displayName = getOptionalParameter(args, ['--name', '-n'])
    const { createProject } = await platformRequestOrThrow<
      {
        createProject: {
          __typename: 'Project'
          id: string
          createdAt: string
          displayName: string
        }
      },
      {
        workspaceId: string
        displayName?: string
      }
    >({
      token,
      body: {
        query: /* graphql */ `
          mutation ($input: { $workspaceId: ID!, $displayName: String }) {
            createProject(input: $input) {
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
            workspaceId,
            displayName,
          },
        },
      },
    })

    return successMessage(`Project ${createProject.displayName} - ${createProject.id} created.`)
  }
}
