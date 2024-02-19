import { Command } from '@prisma/internals'

import { argOrThrow, getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Create implements Command {
  public static new() {
    return new Create()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.workspace,
      '--name': String,
      '-n': '--name',
    })
    const token = await getTokenOrThrow(args)
    const workspaceId = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const displayName = getOptionalParameter(args, ['--name', '-n'])
    const { projectCreate } = await requestOrThrow<
      {
        projectCreate: {
          __typename: string
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
          mutation ($input: MutationProjectCreateInput!) {
            projectCreate(input: $input) {
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

    return messages.resourceCreated(projectCreate)
  }
}
