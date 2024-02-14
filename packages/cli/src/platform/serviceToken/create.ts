import { Command } from '@prisma/internals'

import { argOrThrow, getOptionalParameter, getRequiredParameterOrThrow } from '../lib/parameters'
import { requestOrThrow } from '../lib/pdp'
import { getTokenOrThrow, platformParameters, successMessage } from '../lib/utils'

export class Create implements Command {
  public static new(): Create {
    return new Create()
  }

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
          mutation ($input: { displayName: String, environmentId: String!}) {
            serviceTokenCreate(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on ServiceKeyWithValue {
                value
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

    return successMessage(`New Service Token created: ${serviceTokenCreate.value}`)
  }
}
