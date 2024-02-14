import { Command } from '@prisma/internals'

import { argOrThrow, getRequiredParameterOrThrow } from '../lib/parameters'
import { requestOrThrow } from '../lib/pdp'
import { getTokenOrThrow, platformParameters, successMessage } from '../lib/utils'

export class Disable implements Command {
  public static new(): Disable {
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
          mutation(input: { $environmentId: ID! }) {
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

    return successMessage(
      `Accelerate disabled. Prisma clients connected to ${environmentId} will not be able to send queries through Accelerate.`,
    )
  }
}
