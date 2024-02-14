import { Command } from '@prisma/internals'

import { argOrThrow, getRequiredParameterOrThrow } from '../lib/parameters'
import { requestOrThrow } from '../lib/pdp'
import { getTokenOrThrow, platformParameters, successMessage } from '../lib/utils'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters.serviceToken,
    })
    const token = await getTokenOrThrow(args)
    const serviceTokenId = getRequiredParameterOrThrow(args, ['--serviceToken', '-s'])
    const { serviceTokenDelete } = await requestOrThrow<
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
            id: serviceTokenId,
          },
        },
      },
    })
    return successMessage(`Service Token ${serviceTokenDelete.displayName} deleted.`)
  }
}
