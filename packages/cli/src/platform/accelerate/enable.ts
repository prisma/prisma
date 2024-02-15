import { arg, Command, isError, link } from '@prisma/internals'

import { successMessage } from '../_lib/messages'
import { getOptionalParameter, getRequiredParameterOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { generateConnectionString, getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Enable implements Command {
  public static new(): Enable {
    return new Enable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.environment,
      '--url': String,
      '--serviceToken': Boolean,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const connectionString = getRequiredParameterOrThrow(args, ['--url'])
    const withServiceToken = getOptionalParameter(args, ['--serviceToken']) ?? false
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
          mutation ($input: {environmentId: String!, connectionString: String!}) {
            databaseLinkCreate(input:$input) {
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
        accelerateEnable: {}
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
          mutation ($accelerateEnableInput: { databaseLinkId: String! }, $serviceTokenCreateInput: { environmentId: String! }, withServiceToken: Boolean! ) {
            accelerateEnable(input: { databaseLinkId: $input[''] }) {
              __typename
              ... on Error {
                message
              }
            }
            serviceTokenCreate(input: $input) @include(if: $withServiceToken) {
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
      return successMessage(
        `Accelerate enabled. Use this generated API key in your Accelerate connection string to authenticate requests:\n` +
          '\n' +
          `${generateConnectionString(serviceTokenCreate.value)}\n` +
          '\n' +
          `For more information, check out the Getting started guide here: ${gettingStartedUrl}`,
      )
    } else {
      return successMessage(
        `Accelerate enabled. Use your secure API key in your Accelerate connection string to authenticate requests.\n` +
          `\n` +
          `For more information, check out the Getting started guide here: ${gettingStartedUrl}`,
      )
    }
  }
}
