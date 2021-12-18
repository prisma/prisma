import type { Client } from '../../../getPrismaClient'
import type { ModelAction } from '../applyModel'
import { desugarUserArgs } from './aggregate'
import { createSugarUnpacker } from './aggregate'

/**
 * Executes the `.groupBy` action on a model by reusing {@link aggregate}.
 * @param client to provide dmmf information
 * @param userArgs the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function groupBy(client: Client, userArgs: object | undefined, modelAction: ModelAction) {
  const aggregateArgs = desugarUserArgs(userArgs ?? {})
  const aggregateUnpacker = createSugarUnpacker(userArgs ?? {})

  // we desugar the array into { [key]: boolean }
  if (Array.isArray(userArgs?.['by']) === true) {
    for (const key of userArgs?.['by']) {
      aggregateArgs['select'][key] = true
    }
  }

  return modelAction({
    action: 'groupBy',
    unpacker: aggregateUnpacker,
  })(aggregateArgs)
}
