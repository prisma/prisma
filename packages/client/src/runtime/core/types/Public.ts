/* eslint-disable prettier/prettier */

import { GetResult, Operation } from './GetResult'
import { Payload } from './Payload'
import { Exact } from './Utils'

/*
 * /!\ These types are exposed to the user. Proceed with caution.
 *
 * TODO: Move more hardcoded types from generation into here
 */

export type Args<T, F extends Operation> =
  T extends { [K: symbol]: { types: { [K in F]: { args: any} } } }
  ? T[symbol]['types'][F]['args']
  : T extends { [K: symbol]: { ctx: { [K: symbol]: { types: { [K in F]: { args: any } } } } } }
    ? T[symbol]['ctx'][symbol]['types'][F]['args']
    : never

export type Result<T, A, F extends Operation> =
  T extends { [K: symbol]: { types: { [K in F]: { payload: infer P extends Payload } } } }
  ? GetResult<P, A, F>
  : T extends { [K: symbol]: { ctx: { [K: symbol]: { types: { [K in F]: { payload: infer P extends Payload } } } } } }
    ? GetResult<P, A, F>
    : never

export { type Operation }

export { type Exact }
