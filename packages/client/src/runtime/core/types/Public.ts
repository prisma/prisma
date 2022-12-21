import { GetResult, Operation } from './GetResult'
import { Exact } from './Utils'

/*
 * /!\ These types are exposed to the user.
 * Proceed with caution.
 *
 * TODO: type-level testing
 * TODO: Move more hardcoded types from generation into here
 */

export type Args<T, F extends Operation> = T extends { [K: symbol]: { meta: { [K in F]: { args: any } } } }
  ? T[symbol]['meta'][F]['args']
  : never

export type Result<T, A, F extends Operation> = T extends { [K: symbol]: { meta: { [K in F]: { payload: any } } } }
  ? GetResult<T[symbol]['meta'][F]['payload'], A, F>
  : never

export { type Operation }

export { type Exact }
