import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, isError } from '@prisma/internals'

import { getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Show implements Command {
  public static new() {
    return new Show()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
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

export const getEnvironmentOrThrow = async (input: { token: string; environmentId: string }) => {
  const { token, environmentId } = input

  const { environment } = await requestOrThrow<
    {
      environment: {
        __typename: string
        id: string
        createdAt: string
        displayName: string
        ppg: {
          status: string
        }
        accelerate: {
          status: {
            enabled: boolean
          }
        }
      }
    },
    {
      id: string
    }
  >({
    token,
    body: {
      query: /* GraphQL */ `
        query ($input: QueryEnvironmentInput!) {
          environment(input: $input) {
            __typename
            ... on Error {
              message
            }
            ... on Environment {
              __typename
              id
              displayName
              ppg {
                status
              }
              accelerate {
                status {
                  ... on AccelerateStatusEnabled {
                    __typename
                    enabled
                  }
                  ... on AccelerateStatusDisabled {
                    __typename
                    enabled
                  }
                }
              }
            }
          }
        }
      `,
      variables: {
        input: {
          id: environmentId,
        },
      },
    },
  })

  return environment
}
