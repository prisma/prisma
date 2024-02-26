import { Command } from '@prisma/internals'

import { argOrThrow, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Disable implements Command {
  public static new() {
    return new Disable()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.environment,
    })
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    await requestOrThrow<
      {
        accelerateDisable: {}
      },
      { environmentId: string }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: MutationAccelerateDisableInput!) {
            accelerateDisable(input: $input) {
              __typename
              ... on Error {
                message
              }
            }
          }
        `,
        variables: {
          input: { environmentId },
        },
      },
    })

    return messages.success(
      `Accelerate disabled. Prisma clients connected to ${environmentId} will not be able to send queries through Accelerate.`,
    )
  }
}
