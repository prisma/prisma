import { Command } from '@prisma/internals'

import {
  argOrThrow,
  getPlatformTokenOrThrow,
  getRequiredParameterOrThrow,
  platformRequestOrThrow,
  successMessage,
} from '../platformUtils'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      '--token': String,
      '--id': String,
      '--apikey': String,
    })
    const token = await getPlatformTokenOrThrow(args)
    const id = getRequiredParameterOrThrow(args, ['--id'])
    const { serviceTokenDelete } = await platformRequestOrThrow<
      {
        serviceTokenDelete: {
          displayName: string
        }
      },
      { id: string }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: { id: ID! }) {
            serviceTokenDelete(input: $input) {
              __typename
              ...on Error {
                message
              }
              ...on ServiceToken {
                displayName
              }
            }
          }
        `,
        variables: {
          input: {
            id,
          },
        },
      },
    })
    return successMessage(`Service Token ${serviceTokenDelete.displayName} deleted.`)
  }
}
