import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, isError, link } from '@prisma/internals'

import { getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { generateConnectionString, getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Enable implements Command {
  public static new() {
    return new Enable()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      ...platformParameters.environment,
      '--url': String,
      // TODO rename to "serviceToken" in a future release.
      '--apikey': Boolean,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const connectionString = getRequiredParameterOrThrow(args, ['--url'])
    const withServiceToken = getOptionalParameter(args, ['--apikey']) ?? false
    const { databaseLinkCreate } = await requestOrThrow<
      {
        databaseLinkCreate: {
          __typename: string
          id: string
        }
      },
      {
        environmentId: string
        connectionString: string
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: MutationDatabaseLinkCreateInput!) {
            databaseLinkCreate(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on DatabaseLink {
                id
              }
            }
          }
        `,
        variables: {
          input: {
            environmentId,
            connectionString,
          },
        },
      },
    })
    const { serviceTokenCreate } = await requestOrThrow<
      {
        pulseEnable: {}
        serviceTokenCreate?: {
          value: string
        }
      },
      null,
      {
        pulseEnableInput: { databaseLinkId: string }
        serviceTokenCreateInput: { environmentId: string }
        withServiceToken: boolean
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation (
            $pulseEnableInput: MutationPulseEnableInput!
            $serviceTokenCreateInput: MutationServiceTokenCreateInput!
            $withServiceToken: Boolean!
          ) {
            pulseEnable(input: $pulseEnableInput) {
              __typename
              ... on Error {
                message
              }
            }
            serviceTokenCreate(input: $serviceTokenCreateInput) @include(if: $withServiceToken) {
              __typename
              ... on Error {
                message
              }
              ... on ServiceTokenWithValue {
                value
              }
            }
          }
        `,
        variables: {
          withServiceToken,
          pulseEnableInput: { databaseLinkId: databaseLinkCreate.id },
          serviceTokenCreateInput: { environmentId },
        },
      },
    })

    const gettingStartedUrl = link('https://pris.ly/d/pulse-getting-started')

    if (serviceTokenCreate) {
      return messages.success(
        `Pulse enabled. Use this Pulse connection string to authenticate requests:\n\n${generateConnectionString(serviceTokenCreate.value)}\n\nFor more information, check out the Getting started guide here: ${gettingStartedUrl}`,
      )
    }
      return messages.success(
        `Pulse enabled. Use your secure API key in your Pulse connection string to authenticate requests.\n\nFor more information, check out the Getting started guide here: ${gettingStartedUrl}`,
      )
  }
}
