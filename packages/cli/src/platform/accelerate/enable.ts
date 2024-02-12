import { arg, Command, isError, link } from '@prisma/internals'

import {
  generateConnectionString,
  getOptionalParameter,
  getPlatformTokenOrThrow,
  getRequiredParameterOrThrow,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../../utils/platform'

export class Enable implements Command {
  public static new(): Enable {
    return new Enable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      // todo this is actually databaseLinkId in api right now
      ...platformParameters.environment,
      '--url': String,
      '--serviceToken': Boolean,
      '--region': String,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)
    const url = getRequiredParameterOrThrow(args, ['--url'])
    url // todo
    const databaseLinkId = 'todo'
    const serviceToken = getOptionalParameter(args, ['--serviceToken'])
    // region won't be used in this first iteration
    // const _region = getOptionalParameter(args, ['--region'])

    await platformRequestOrThrow<
      {
        accelerateEnable: {}
      },
      { databaseLinkId: string }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: { databaseLinkId: String! }) {
            accelerateEnable(input: $input) {
              __typename
              ... on Error {
                message
              }
            }
          }
        `,
        variables: {
          input: { databaseLinkId },
        },
      },
    })

    if (serviceToken) {
      const payload = await platformRequestOrThrow<{
        data: {
          tenantAPIKey: string
        }
        error: null | { message: string }
      }>({
        token,
        path: `/${workspace}/${project}/settings/api-keys/create`,
        route: '_app.$organizationId_.$projectId.settings.api-keys.create',
        payload: {},
      })
      if (payload.error?.message) {
        throw new Error(payload.error.message)
      }
      return successMessage(
        `Accelerate enabled. Use this generated API key in your Accelerate connection string to authenticate requests:\n\n${generateConnectionString(
          payload.data.tenantAPIKey,
        )}\n\nFor more information, check out the Getting started guide here: ${link(
          'https://pris.ly/d/accelerate-getting-started',
        )}`,
      )
    } else {
      return successMessage(
        `Accelerate enabled. Use your secure API key in your Accelerate connection string to authenticate requests.\n\nFor more information, check out the Getting started guide here: ${link(
          'https://pris.ly/d/accelerate-getting-started',
        )}`,
      )
    }
  }
}
