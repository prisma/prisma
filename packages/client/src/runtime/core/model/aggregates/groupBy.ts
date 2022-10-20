import type { ModelAction } from '../applyModel'
import type { UserArgs } from '../UserArgs'
import { desugarUserArgs as desugarUserArgsAggregate } from './aggregate'

/**
 * Transforms the `userArgs` for the `.groupBy` shorthand. It is an API sugar.
 * It reuses the logic from the `.aggregate` shorthand and adds additional
 * handling for the `by` clause. The goal here is to desugar it into something
 * that is understood by the QE.
 * @param args to transform
 * @returns
 */
function desugarUserArgs(args?: UserArgs) {
  const _userArgs = desugarUserArgsAggregate(args ?? {})

  // we desugar the array into { [key]: boolean }
  if (Array.isArray(_userArgs.by)) {
    for (const key of _userArgs.by) {
      if (typeof key === 'string') {
        _userArgs['select'][key] = true
      }
    }
  }

  return _userArgs
}

/**
 * Creates an unpacker that adds sugar to the basic result of the QE. An
 * unpacker helps to transform a result before returning it to the user.
 * @param args the user input
 * @returns
 */
export function createUnpacker(args?: UserArgs) {
  return (data: object[]) => {
    if (typeof args?.['_count'] === 'boolean') {
      data.forEach((row) => {
        row['_count'] = row['_count']['_all']
      })
    }

    return data
  }
}

/**
 * Executes the `.groupBy` action on a model by reusing {@link aggregate}.
 * @param args the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function groupBy(args: UserArgs | undefined, modelAction: ModelAction) {
  return modelAction({
    action: 'groupBy',
    unpacker: createUnpacker(args),
    argsMapper: desugarUserArgs,
  })(args)
}
