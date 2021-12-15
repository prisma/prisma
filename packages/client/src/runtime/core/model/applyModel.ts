import type { DMMFHelper } from '../../dmmf'
import type { Action, InternalRequestParams } from '../../getPrismaClient'
import { createPrismaPromise } from '../request/createPrismaPromise'
import { getCallSite } from '../utils/getCallSite'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'

const EMPTY_OBJECT = {}

/**
 * Dynamically creates a model interface via a proxy
 * @param request to trigger the request execution
 * @param dmmfHelper to provide dmmf information
 * @param dmmfModelName the dmmf name of the model
 * @param modelCache to avoid creating duplicate proxies
 * @returns
 */
export function applyModel(
  request: (internalParams: InternalRequestParams) => Promise<unknown>,
  dmmfHelper: DMMFHelper,
  dmmfModelName: string,
) {
  // we retrieve the model that is described from the DMMF
  const dmmfModel = dmmfHelper.modelMap[dmmfModelName]
  // we also get information about the methods it can have
  const dmmfModelMapping = dmmfHelper.mappingsMap[dmmfModel.name]
  const jsModelName = dmmfToJSModelName(dmmfModelName)

  // we construct a proxy that acts as the model interface
  const model = new Proxy(EMPTY_OBJECT, {
    get(_, prop: string) {
      // these are not allowed or valid actions on a model
      if (['model', 'plural'].includes(prop)) return undefined

      // only valid actions are allowed to be called on it
      if (dmmfModelMapping[prop] === undefined) return undefined

      // we allow for the actions to be called from models
      return (userArgs: object) => {
        return createPrismaPromise((txId, inTx, span) => {
          // the groups below are a request's building blocks
          const data = { args: userArgs, dataPath: [] as string[] }
          const action = { action: prop as Action, model: dmmfModelName }
          const method = { clientMethod: `${jsModelName}.${prop}` }
          const tx = { runInTransaction: !!inTx, transactionId: txId }
          const trace = { callsite: getCallSite(), span: span }

          return request({ ...data, ...action, ...method, ...tx, ...trace })
        })
      }
    },
  })

  return model
}
