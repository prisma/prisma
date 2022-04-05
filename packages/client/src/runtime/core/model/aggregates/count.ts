import type { Client } from '../../../getPrismaClient'
import type { ModelAction } from '../applyModel'
import type { UserArgs } from '../UserArgs'
import { aggregate } from './aggregate'

/**
 * Executes the `.count` action on a model via {@link aggregate}.
 * @param client to provide dmmf information
 * @param userArgs the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function count(client: Client, userArgs: UserArgs | undefined, modelAction: ModelAction) {
  const { select, ..._userArgs } = userArgs ?? {} // exclude select

  // count is an aggregate, we reuse that but hijack its unpacker
  if (typeof select === 'object') {
    // we transpose the original select field into the _count field
    return aggregate(client, { ..._userArgs, _count: select }, (p) =>
      modelAction({ ...p, action: 'count', unpacker: (data) => p.unpacker?.(data)['_count'] }),
    ) // for count selects, return the relevant part of the result
  } else {
    return aggregate(client, { ..._userArgs, _count: { _all: true } }, (p) =>
      modelAction({ ...p, action: 'count', unpacker: (data) => p.unpacker?.(data)['_count']['_all'] }),
    ) // for simple counts, just return the result that is a number
  }
}
