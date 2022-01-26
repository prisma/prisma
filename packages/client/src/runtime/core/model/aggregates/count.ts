import type { Client } from '../../../getPrismaClient'
import type { ModelAction } from '../applyModel'
import { aggregate } from './aggregate'

/**
 * Executes the `.count` action on a model via {@link aggregate}.
 * @param client to provide dmmf information
 * @param userArgs the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export async function count(client: Client, userArgs: object | undefined, modelAction: ModelAction) {
  if (typeof userArgs?.['select'] === 'object') {
    const result = await aggregate(client, { _count: userArgs['select'] }, modelAction)

    return (result as object)['_count'] // for selects, just return the relevant part
  } else {
    const result = await aggregate(client, { _count: { _all: true } }, modelAction)

    return (result as object)['_count']['_all'] // for a simple count, return numbers
  }
}
