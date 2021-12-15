import type { Client } from '../../getPrismaClient'
import { deepSet } from '../../utils/deep-set'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'
import type { DMMF } from '@prisma/generator-helper'
import type { applyModel, ModelAction } from './applyModel'

/**
 * The fluent API makes that nested relations can be retrieved at once. It's a
 * helper for writing `select` statements on relations with a chaining api.
 * Because of this, we automatically add `select` statements to the query, that
 * also means that we need to provide a `dataPath` for unpacking nested values.
 * @see {getNextUserArgs}
 * @param dmmfModelName
 * @param prevDataPath
 * @returns
 */
function getNextDataPath(fluentPropName?: string, prevDataPath?: string[]) {
  if (fluentPropName === undefined || prevDataPath === undefined) return []

  return [...prevDataPath, 'select', dmmfToJSModelName(fluentPropName)]
}

/**
 * @see {getNextDataPath} for introduction. The goal of the fluent API is to
 * make it easy to retrieve nested relations. For this, we construct the query
 * args that are necessary to retrieve the nested relations. It consists of
 * nesting `select` statements each time that we access a relation.
 * @param callArgs usually passed on the last call of the chaining api
 * @param prevArgs when multiple chaining occurs, they are the previous
 * @param nextDataPath path where to set `callArgs` in `prevArgs`
 * @example
 * ```ts
 * prisma.user.findUnique().link().user()
 *
 * // will end up with an args like this:
 * // args {
 * //   "where": {
 * //     "email": "1639498523518@gmail.com"
 * //   },
 * //   "select": {
 * //     "link": {
 * //       "select": {
 * //         "user": true
 * //       }
 * //     }
 * //   }
 * // }
 * ```
 */
function getNextUserArgs(callArgs: object, prevArgs: object | undefined, nextDataPath: string[]) {
  if (prevArgs === undefined) return callArgs ?? {}

  return deepSet(prevArgs, nextDataPath, callArgs || true) as object
}

/**
 * Dynamically creates a fluent API from a `modelAction` and a `dmmfModelName`.
 * We use the current `dmmfModelName` to determine what can be chained on next.
 * The fluent API allows to chain on model relations to provide an alternative
 * way to fetch and access nested data all at once. When triggered, it calls
 * `modelActions` after having accumulated `prevDataPath` and `prevUserArgs`
 * with the chaining. You can find an example of usage at {@link applyModel}.
 * @param client to provide dmmf information
 * @param dmmfModelName the dmmf name of the model to apply the api to
 * @param modelAction a callback action that triggers request execution
 * @param fluentPropName the name of the api link that was just called
 * @param prevDataPath the dataPath from the previous api link
 * @param prevUserArgs the userArgs from the previous api link
 * @remarks optional parameters are empty on the first call via
 * {@link applyModel}
 * @returns
 */
export function applyFluent(
  client: Client,
  dmmfModelName: string,
  modelAction: ModelAction,
  fluentPropName?: string,
  prevDataPath?: string[],
  prevUserArgs?: object,
) {
  // we retrieve the model that is described from the DMMF
  const dmmfModel = client._dmmf.modelMap[dmmfModelName]

  // map[field.name] === field, basically for quick access
  const dmmfModelFieldMap = dmmfModel.fields.reduce(
    (acc, field) => ({ ...acc, [field.name]: field }),
    {} as { [dmmfModelFieldName: string]: DMMF.Field },
  )

  // we return a regular model action but proxy its return
  return (userArgs: object) => {
    // first call defaults: nextDataPath => [], nextUserArgs => userArgs
    const nextDataPath = getNextDataPath(fluentPropName, prevDataPath)
    const nextUserArgs = getNextUserArgs(userArgs, prevUserArgs, nextDataPath)
    const prismaPromise = modelAction({ dataPath: nextDataPath })(nextUserArgs)
    // TODO: have a custom unpacker here instead of that logic in ClientFetcher

    // take control of the return promise to allow chaining
    return new Proxy(prismaPromise, {
      get(target, prop: string) {
        // fluent api only works on fields that are relational
        if (dmmfModelFieldMap[prop] && dmmfModelFieldMap[prop].kind === 'object') {
          const modelParams = [client, dmmfModelFieldMap[prop].type, modelAction] as const

          return applyFluent(...modelParams, prop, nextDataPath, nextUserArgs)
        }

        return target[prop] // let the promise behave normally
      },
    })
  }
}
