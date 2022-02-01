import type { Client } from '../../../getPrismaClient'
import type { ModelAction } from '../applyModel'
import type { UserArgs } from '../UserArgs'
import { desugarUserArgs as desugarUserArgsAggregate } from './aggregate'

/**
 * Transforms the `userArgs` for the `.groupBy` shorthand. It is an API sugar.
 * It reuses the logic from the `.aggregate` shorthand and adds additional
 * handling for the `by` clause. The goal here is to desugar it into something
 * that is understood by the QE.
 * @param userArgs to transform
 * @returns
 */
function desugarUserArgs(userArgs: UserArgs) {
  const _userArgs = desugarUserArgsAggregate(userArgs)

  // we desugar the array into { [key]: boolean }
  if (Array.isArray(userArgs['by'])) {
    for (const key of userArgs['by']) {
      if (_userArgs['select'] && typeof key === 'string') {
        _userArgs['select'][key] = true
      }
    }
  }

  return _userArgs
}

/**
 * Creates an unpacker that adds sugar to the basic result of the QE. An
 * unpacker helps to transform a result before returning it to the user.
 * @param userArgs the user input
 * @returns
 */
export function createUnpacker(userArgs: UserArgs) {
  return (data: object[]) => {
    if (typeof userArgs['_count'] === 'boolean') {
      data.forEach((row) => {
        row['_count'] = row['_count']['_all']
      })
    }

    return data
  }
}

/**
 * Executes the `.groupBy` action on a model by reusing {@link aggregate}.
 * @param client to provide dmmf information
 * @param userArgs the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function groupBy(client: Client, userArgs: UserArgs | undefined, modelAction: ModelAction) {
  const groupByArgs = desugarUserArgs(userArgs ?? {})
  const groupByUnpacker = createUnpacker(userArgs ?? {})

  return modelAction({
    action: 'groupBy',
    unpacker: groupByUnpacker,
  })(groupByArgs)
}
