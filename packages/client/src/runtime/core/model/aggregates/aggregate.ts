import type { Client } from '../../../getPrismaClient'
import type { ModelAction } from '../applyModel'
import type { UserArgs } from '../UserArgs'
import { aggregateMap } from './utils/aggregateMap'

/**
 * Transforms the `userArgs` for the `.aggregate` shorthand. It is an API sugar
 * for not having to do things like: `{select: {_avg: {select: {age: true}}}}`.
 * The goal here is to desugar it into something that is understood by the QE.
 * @param userArgs to transform
 * @returns
 */
export function desugarUserArgs(userArgs: UserArgs) {
  const _userArgs = desugarCountInUserArgs(userArgs)
  const userArgsEntries = Object.entries(_userArgs)

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
    { select: {} } as UserArgs,
  )
}

/**
 * Desugar `userArgs` when it contains `{_count: true}`.
 * @param userArgs the user input
 * @returns
 */
function desugarCountInUserArgs(userArgs: UserArgs) {
  if (typeof userArgs['_count'] === 'boolean') {
    return { ...userArgs, _count: { _all: userArgs['_count'] } }
  }

  return userArgs
}

/**
 * Creates an unpacker that adds sugar to the basic result of the QE. An
 * unpacker helps to transform a result before returning it to the user.
 * @param userArgs the user input
 * @returns
 */
export function createUnpacker(userArgs: UserArgs) {
  return (data: object) => {
    if (typeof userArgs['_count'] === 'boolean') {
      data['_count'] = data['_count']['_all']
    }

    return data
  }
}

/**
 * Executes the `.aggregate` action on a model.
 * @see {desugarUserArgs}
 * @param client to provide dmmf information
 * @param userArgs the user input to desugar
 * @param modelAction a callback action that triggers request execution
 * @returns
 */
export function aggregate(client: Client, userArgs: UserArgs | undefined, modelAction: ModelAction) {
  const aggregateArgs = desugarUserArgs(userArgs ?? {})
  const aggregateUnpacker = createUnpacker(userArgs ?? {})

  return modelAction({
    action: 'aggregate',
    unpacker: aggregateUnpacker,
  })(aggregateArgs)
}
