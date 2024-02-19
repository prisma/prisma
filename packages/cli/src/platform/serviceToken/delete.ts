import { Command } from '@prisma/internals'

import { argOrThrow, getRequiredParameterOrThrow } from '../_lib/cli/parameters'
import { messages } from '../_lib/messages'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Delete implements Command {
  public static new(legacy: boolean = false) {
    return new Delete(legacy)
  }
  constructor(private readonly legacy: boolean = false) {}

  public async parse(argv: string[]) {
    const args = argOrThrow(argv, {
      ...platformParameters[this.legacy ? 'apikey' : 'serviceToken'],
    })
    const token = await getTokenOrThrow(args)
    const serviceTokenId = this.legacy
      ? getRequiredParameterOrThrow(args, ['--apikey'] as any)
      : getRequiredParameterOrThrow(args, ['--serviceToken', '-s'] as any)
    const { serviceTokenDelete } = await requestOrThrow<
      {
        serviceTokenDelete: {
          __typename: string
          id: string
          displayName: string
        }
      },
      { id: string }
    >({
      token,
      body: {
        query: /* GraphQL */ `
          mutation ($input: MutationServiceTokenDeleteInput!) {
            serviceTokenDelete(input: $input) {
              __typename
              ... on Error {
                message
              }
              ... on ServiceTokenNode {
                id
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
    return messages.resourceDeleted(this.legacy ? { ...serviceTokenDelete, __typename: 'APIKey' } : serviceTokenDelete)
  }
}
