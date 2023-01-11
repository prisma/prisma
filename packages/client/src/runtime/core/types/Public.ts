/* eslint-disable prettier/prettier */

import { GetResult, Operation } from './GetResult'
import { Exact } from './Utils'

/*
 * /!\ These types are exposed to the user. Proceed with caution.
 *
 * TODO: Move more hardcoded types from generation into here
 */

export type Args<T, F extends Operation> =
  T extends { [K: symbol]: { types: { [K in F]: { args: any} } } }
  ? T[symbol]['types'][F]['args']
  : never

export type Result<T, A, F extends Operation> =
  T extends { [K: symbol]: { types: { [K in F]: { payload: any } } } }
  ? GetResult<T[symbol]['types'][F]['payload'], A, F>
  : never

export type Payload<T, F extends Operation> =
  T extends { [K: symbol]: { types: { [K in F]: { payload: any } } } }
  ? T[symbol]['types'][F]['payload']
  : never

export { type Operation }

export { type Exact }
