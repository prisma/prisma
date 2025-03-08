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
      '--region': String,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const connectionString = getRequiredParameterOrThrow(args, ['--url'])
    const withServiceToken = getOptionalParameter(args, ['--apikey']) ?? false
    const regionId = getOptionalParameter(args, ['--region'])
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
        regionId?: string
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
            ...(regionId && { regionId }),
          },
        },
      },
    })
    const { serviceTokenCreate } = await requestOrThrow<
      {
        accelerateEnable: Record<string, never>
        serviceTokenCreate?: {
          value: string
        }
      },
      null,
      {
        accelerateEnableInput: { databaseLinkId: string }
        serviceTokenCreateInput: { environmentId: string }
        withServiceToken: boolean
      }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation (
            $accelerateEnableInput: MutationAccelerateEnableInput!
            $serviceTokenCreateInput: MutationServiceTokenCreateInput!
            $withServiceToken: Boolean!
          ) {
            accelerateEnable(input: $accelerateEnableInput) {
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
          accelerateEnableInput: { databaseLinkId: databaseLinkCreate.id },
          serviceTokenCreateInput: { environmentId },
        },
      },
    })

    const gettingStartedUrl = link('https://pris.ly/d/accelerate-getting-started')

    if (serviceTokenCreate) {
      return messages.success(
        `Accelerate enabled. Use this Accelerate connection string to authenticate requests:\n\n${generateConnectionString(serviceTokenCreate.value)}\n\nFor more information, check out the Getting started guide here: ${gettingStartedUrl}`,
      )
    }
    return messages.success(
      `Accelerate enabled. Use your secure API key in your Accelerate connection string to authenticate requests.\n\nFor more information, check out the Getting started guide here: ${gettingStartedUrl}`,
    )
  }
}
