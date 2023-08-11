import type { UserArgs } from '../../request/UserArgs'
import type { ModelAction } from '../applyModel'
import { aggregateMap } from './utils/aggregateMap'

/**
 * Transforms the `userArgs` for the `.aggregate` shorthand. It is an API sugar
 * for not having to do things like: `{select: {_avg: {select: {age: true}}}}`.
 * The goal here is to desugar it into something that is understood by the QE.
 * @param args to transform
 * @returns
 */
export function desugarUserArgs(args: UserArgs = {}) {
  const _args = desugarCountInUserArgs(args)
  const userArgsEntries = Object.entries(_args)

  return userArgsEntries.reduce(
    (aggregateArgs, [key, value]) => {
      if (aggregateMap[key] !== undefined) {
        // if it's an aggregate, we re-wrap into select
        aggregateArgs['select']![key] = { select: value }
      } else {
        aggregateArgs[key] = value // or leave it alone
      }

      return aggregateArgs
    },
    { select: {} } as UserArgs & { select: UserArgs },
  )
}

/**
 * Desugar `userArgs` when it contains `{_count: true}`.
 * @param args the user input
 * @returns
 */
function desugarCountInUserArgs(args: UserArgs = {}) {
  if (typeof args['_count'] === 'boolean') {
    return { ...args, _count: { _all: args['_count'] } }
  }

  return args
}

/**
 * Creates an unpacker that adds sugar to the basic result of the QE. An
 * unpacker helps to transform a result before returning it to the user.
 * @param args the user input
 * @returns
 */
export function createUnpacker(args: UserArgs = {}) {
  return (data: object) => {
    if (typeof args['_count'] === 'boolean') {
      data['_count'] = data['_count']['_all']
    }

    return data
  }
}

/**
 * Executes the `.aggregate` action on a model.
 * @see {desugarUserArgs}
 * @param args the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function aggregate(args: UserArgs | undefined, modelAction: ModelAction) {
  const aggregateUnpacker = createUnpacker(args)

  return modelAction({
    action: 'aggregate',
    unpacker: aggregateUnpacker,
    argsMapper: desugarUserArgs,
  })(args)
}
