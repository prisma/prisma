import { Command } from '@prisma/internals'

import {
  argOrThrow,
  getPlatformTokenOrThrow,
  getRequiredParameterOrThrow,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
} from '../platformUtils'

export class Disable implements Command {
  public static new(): Disable {
    return new Disable()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.environment,
    })
    const token = await getPlatformTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    await platformRequestOrThrow<
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
