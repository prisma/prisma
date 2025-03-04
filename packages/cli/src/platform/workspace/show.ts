import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'

import { argOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new() {
    return new Show()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = argOrThrow(argv, {
      ...platformParameters.global,
    })
    const token = await getTokenOrThrow(args)
    const userWorkspaces = await getUserWorkspacesOrThrow({ token })

    return messages.resourceList(userWorkspaces)
  }
}

export const getUserWorkspacesOrThrow = async (input: { token: string }) => {
  const { token } = input
  const { me } = await requestOrThrow<{
    me: {
      workspaces: {
        __typename: string
        id: string
        displayName: string
        createdAt: string
        isDefault: boolean
      }[]
    }
  }>({
    token,
    body: {
      query: /* GraphQL */ `
        query {
          me {
            __typename
            workspaces {
              id
              displayName
              createdAt
              isDefault
            }
          }
        }
      `,
    },
  })

  return me.workspaces
}

export const getDefaultWorkspaceOrThrow = async (input: { token: string }) => {
  const { token } = input
  const { me } = await requestOrThrow<{
    me: {
      workspaces: {
        __typename: string
        id: string
        displayName: string
        createdAt: string
        isDefault: boolean
      }[]
    }
  }>({
    token,
    body: {
      query: /* GraphQL */ `
        query {
          me {
            __typename
            workspaces {
              id
              displayName
              createdAt
              isDefault
            }
          }
        }
      `,
    },
  })

  const defaultWorkspace = me.workspaces.find((_) => _.isDefault)

  if (!defaultWorkspace) {
    throw new Error('No default workspace found')
  }

  return defaultWorkspace
}
