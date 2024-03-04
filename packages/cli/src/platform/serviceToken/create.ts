import { Command } from '@prisma/internals'

import { argOrThrow, getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Create implements Command {
  public static new(legacy: boolean = false) {
    return new Create(legacy)
  }
  constructor(private readonly legacy: boolean = false) {}

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.environment,
      '--name': String,
      '-n': '--name',
    })
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const displayName = getOptionalParameter(args, ['--name', '-n'])
    const { serviceTokenCreate } = await requestOrThrow<
      {
        serviceTokenCreate: {
          value: string
          serviceToken: {
            __typename: string
            id: string
            createdAt: string
            displayName: string
          }
        }
      },
      {
        displayName?: string
        environmentId?: string
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: MutationServiceTokenCreateInput!) {
            serviceTokenCreate(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on ServiceTokenWithValue {
                value
                serviceToken {
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
            displayName,
            environmentId,
          },
        },
      },
    })

    const resource = this.legacy
      ? {
          ...serviceTokenCreate.serviceToken,
          __typename: 'APIKey',
        }
      : serviceTokenCreate.serviceToken

    return messages.sections([messages.resourceCreated(resource), messages.info(serviceTokenCreate.value)])
  }
}
