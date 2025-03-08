import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'

import { argOrThrow, getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Create implements Command {
  public static new() {
    return new Create()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = argOrThrow(argv, {
      ...platformParameters.workspace,
      '--name': String,
      '-n': '--name',
    })
    const workspaceId = getRequiredParameterOrThrow(args, ['--workspace', '-w'])
    const displayName = getOptionalParameter(args, ['--name', '-n'])

    const project = await createProjectOrThrow({
      token: await getTokenOrThrow(args),
      workspaceId,
      displayName,
    })

    return messages.resourceCreated(project)
  }
}

export const createProjectOrThrow = async (input: {
  token: string
  workspaceId: string
  displayName?: string
  environmentDisplayName?: string
  allowRemoteDatabases?: boolean
  ppgRegion?: string
}) => {
  const { token, ...mutationInput } = input
  const { projectCreate } = await requestOrThrow<
    {
      projectCreate: {
        __typename: string
        id: string
        createdAt: string
        displayName: string
        environmentDisplayName: string
        allowRemoteDatabases: boolean
        ppgRegion: string
        defaultEnvironment: {
          id: string
          displayName: string
        }
      }
    },
    {
      workspaceId: string
      displayName?: string
      environmentDisplayName?: string
      allowRemoteDatabases?: boolean
      ppgRegion?: string
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
              defaultEnvironment {
                id
                displayName
              }
            }
          }
        }
      `,
      variables: {
        input: mutationInput,
      },
    },
  })

  return projectCreate
}
