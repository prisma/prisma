import { Command } from '@prisma/internals'

import { messages } from '../_lib/messages'
import { argOrThrow, getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Create implements Command {
  public static new(): Create {
    return new Create()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.project,
      '--name': String,
      '-n': '--name',
    })
    const token = await getTokenOrThrow(args)
    const projectId = getRequiredParameterOrThrow(args, ['--project', '-p'])
    const displayName = getOptionalParameter(args, ['--name', '-n'])
    const { createEnvironment } = await requestOrThrow<
      {
        createEnvironment: {
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
          mutation ($input: { $projectId: ID!, $displayName: String }) {
            createEnvironment(input: $input) {
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
            projectId,
            displayName,
          },
        },
      },
    })

    return messages.resourceCreated(createEnvironment)
  }
}
