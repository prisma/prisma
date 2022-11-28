import type { ModelAction } from '../applyModel'
import type { UserArgs } from '../UserArgs'
import { createUnpacker as createUnpackerAggregate, desugarUserArgs as desugarUserArgsAggregate } from './aggregate'

/**
 * Transforms the `userArgs` for the `.count` shorthand. It is an API sugar. It
 * reuses the logic from the `.aggregate` shorthand to add additional handling.
 * The goal here is to desugar it into something that is understood by the QE.
 * @param args to transform
 * @returns
 */
function desugarUserArgs(args: UserArgs = {}) {
  const { select, ..._args } = args // exclude select

  if (typeof select === 'object') {
    return desugarUserArgsAggregate({ ..._args, _count: select })
  } else {
    return desugarUserArgsAggregate({ ..._args, _count: { _all: true } })
  }
}

/**
 * Creates an unpacker that adds sugar to the basic result of the QE. An
 * unpacker helps to transform a result before returning it to the user.
 * @param args the user input
 * @returns
 */
export function createUnpacker(args: UserArgs = {}) {
  if (typeof args['select'] === 'object') {
    return (data: object) => createUnpackerAggregate(args)(data)['_count']
  } else {
    return (data: object) => createUnpackerAggregate(args)(data)['_count']['_all']
  }
}

/**
 * Executes the `.count` action on a model via {@link aggregate}.
 * @param args the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function count(args: UserArgs | undefined, modelAction: ModelAction) {
  return modelAction({
    action: 'count',
    unpacker: createUnpacker(args),
    argsMapper: desugarUserArgs,
  })(args)
}
